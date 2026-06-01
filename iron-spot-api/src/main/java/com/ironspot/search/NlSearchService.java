package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.text.SafeEcho;
import com.ironspot.gym.GymRepository;
import com.ironspot.gym.NaverSearchService;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.gym.dto.NaverPlaceResult;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dto.NlSearchRequest;
import com.ironspot.search.dto.NlSearchResponse;
import com.ironspot.search.dto.ParsedFilters;
import com.ironspot.search.dto.UnregisteredPlace;
import com.ironspot.search.llm.LlmClient;
import io.sentry.Breadcrumb;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class NlSearchService {

    private final LlmClient llmClient;
    private final DslValidator dslValidator;
    private final LocationResolver locationResolver;
    private final SqlBuilder sqlBuilder;
    private final InterpretationFormatter interpretationFormatter;
    private final NlSearchQuotaService quotaService;
    private final NlSearchEmptyResultReporter emptyResultReporter;
    private final NlSearchLogWriter logWriter;
    private final NaverSearchService naverSearchService;
    private final GymRepository gymRepository;

    // Mirrors the 60-char cap applied by NaverSearchService.sanitiseQuery; the
    // merge keyword is built to fit so its "근처 헬스장" suffix is never truncated.
    private static final int NAVER_QUERY_MAX_LENGTH = 60;

    @Transactional(readOnly = true)
    public NlSearchResponse search(NlSearchRequest req, UserPrincipal principal) {
        long startNanos = System.nanoTime();
        SearchDsl dsl = null;
        Integer totalCount = null;
        String outcome = "success";
        try {
            // REQUIRES_NEW commits the count immediately, so a downstream LLM/SQL
            // failure does not refund the call. Quota-rejection (429) propagates as
            // BusinessException and emits a breadcrumb via the existing catch — gives
            // ops a per-user "hammering at limit" signal in Sentry.
            int quotaUsed = quotaService.checkAndIncrement(principal);
            dsl = llmClient.parse(req.query());
            if (dsl.error() != null) {
                outcome = "dsl_error";
                throw new BusinessException(translateDslError(dsl.error()), HttpStatus.BAD_REQUEST);
            }
            ValidatedSearch validated = dslValidator.validate(dsl);
            ResolvedLocation location = locationResolver.resolve(
                validated.location(), req.userLat(), req.userLng());
            List<GymWithMachineCountResponse> gyms = sqlBuilder.execute(location, validated.filters());
            String interpretation = interpretationFormatter.format(dsl);
            totalCount = gyms.size();
            ParsedFilters parsedFilters = toParsedFilters(validated.filters());
            // F7 NL search Naver merge: only when the query has no specific
            // brand/category/machine filter. Naver has no machine metadata so
            // filtered queries can't meaningfully match Naver results — emitting
            // them would dilute the "Panatta 머신" intent with random gyms.
            List<UnregisteredPlace> unregistered = isGenericQuery(parsedFilters)
                ? fetchUnregisteredNaverPlaces(validated.location(), location)
                : List.of();
            return new NlSearchResponse(
                gyms, interpretation, totalCount, parsedFilters, location, unregistered,
                new NlSearchResponse.QuotaInfo(quotaUsed, NlSearchQuotaService.MONTHLY_LIMIT));
        } catch (BusinessException e) {
            if ("success".equals(outcome)) outcome = "business_error:" + e.getStatus().value();
            throw e;
        } catch (RuntimeException e) {
            outcome = "runtime_error";
            throw e;
        } finally {
            long durationMs = (System.nanoTime() - startNanos) / 1_000_000L;
            recordBreadcrumb(req.query(), dsl, totalCount, durationMs, outcome);
            emptyResultReporter.reportIfEmpty(req.query(), totalCount);
            // Skip-on-429 per grill Q12 — quota-rejected queries never ran the
            // pipeline so they don't represent a "real" search attempt for H2
            // analytics. All other outcomes (success, dsl_error, runtime_error,
            // other 4xx) land in nl_search_log. Writer swallows its own
            // exceptions; this finally block stays exception-safe.
            if (!"business_error:429".equals(outcome)) {
                int filterCount = dsl != null ? dsl.machineFilters().size() : 0;
                logWriter.write(principal, req.query(), outcome, totalCount, durationMs, filterCount);
            }
        }
    }

    private ParsedFilters toParsedFilters(List<ResolvedFilter> filters) {
        // scope is consistent across filters (DslValidator.validateScopeConsistency enforces it).
        // minCount: max across filters — a single representative number for the toast hint
        // shown when the user falls back to FilterPanel. EACH/COMBINED both keep this safe.
        List<UUID> brandIds = filters.stream().map(ResolvedFilter::brandId).filter(java.util.Objects::nonNull).distinct().toList();
        List<UUID> categoryIds = filters.stream().map(ResolvedFilter::categoryId).filter(java.util.Objects::nonNull).distinct().toList();
        List<UUID> templateIds = filters.stream().flatMap(f -> f.templateIds().stream()).distinct().toList();
        Integer minCount = filters.stream().mapToInt(ResolvedFilter::minCount).max().stream().boxed().findFirst().orElse(null);
        String scope = filters.isEmpty() ? null : filters.get(0).scope().name().toLowerCase();
        return new ParsedFilters(brandIds, categoryIds, templateIds, minCount, scope);
    }

    private boolean isGenericQuery(ParsedFilters parsedFilters) {
        // Generic = no brand, no category, no template selected. Location-only
        // queries like "강남역 헬스장" qualify. Filtered queries like "강남역
        // 파나타 머신" do not.
        return parsedFilters.brandIds().isEmpty()
            && parsedFilters.categoryIds().isEmpty()
            && parsedFilters.templateIds().isEmpty();
    }

    private List<UnregisteredPlace> fetchUnregisteredNaverPlaces(
        Location parsedLocation, ResolvedLocation resolved) {
        // Naver 지역검색 is keyword-only (no coordinate/radius param), so we (1)
        // key the search off the RESOLVED PLACE — not the raw sentence — so that
        // "보정동 올리브영 근처" and "보정동 올리브영 주변 2km" issue the SAME Naver
        // query (the old raw-query path made them different searches → different
        // results); and (2) geo-filter the results against the resolved centre +
        // radius so the unregistered list honours the same distance the
        // registered ST_DWithin search does. Results sorted by distance for a
        // deterministic order. Naver call is cached 60s via Caffeine; failures
        // are swallowed so the NL search still returns IronSpot results.
        String keyword = naverMergeKeyword(parsedLocation);
        List<NaverPlaceResult> naverPlaces;
        try {
            naverPlaces = naverSearchService.search(keyword);
        } catch (RuntimeException e) {
            log.warn("Naver merge failed for keyword='{}': {} — returning IronSpot only",
                SafeEcho.truncate(Normaliser.normalise(keyword), 50), e.getMessage());
            return List.of();
        }
        if (naverPlaces.isEmpty()) return List.of();

        double centerLat = resolved.coordinates().lat();
        double centerLng = resolved.coordinates().lng();
        double radiusKm = resolved.radiusKm();

        record Scored(NaverPlaceResult place, double distanceKm) {}
        List<NaverPlaceResult> withinRadius = naverPlaces.stream()
            .filter(p -> p.latitude() != null && p.longitude() != null)
            .map(p -> new Scored(p, GeoDistance.haversineKm(centerLat, centerLng, p.latitude(), p.longitude())))
            .filter(s -> s.distanceKm() <= radiusKm)
            .sorted(Comparator.comparingDouble(Scored::distanceKm))
            .map(Scored::place)
            .toList();
        if (withinRadius.isEmpty()) return List.of();

        List<String> candidateIds = withinRadius.stream().map(NaverPlaceResult::id).toList();
        Set<String> registeredIds = gymRepository.findRegisteredNaverPlaceIdsAmong(candidateIds);
        return withinRadius.stream()
            .filter(p -> !registeredIds.contains(p.id()))
            .map(p -> new UnregisteredPlace(
                p.id(),
                p.name(),
                p.roadAddress() == null || p.roadAddress().isBlank() ? p.address() : p.roadAddress(),
                p.latitude(),
                p.longitude()
            ))
            .toList();
    }

    private String naverMergeKeyword(Location parsedLocation) {
        // Naver 지역검색 is keyword-only, and empirically the phrase "{place} 근처
        // 헬스장" is what actually returns nearby gyms: "{place} 헬스장" returns
        // NOTHING, and the raw user phrasing "{place} 주변 2km 헬스장" also returns
        // nothing (the literal "주변 2km" tokens break the match) — that mismatch
        // was the user-reported bug where "주변 2km" yielded fewer results than
        // "근처". We therefore normalise every variant to "{place} 근처 헬스장" so
        // any radius phrasing of the same place issues the identical Naver query.
        // Current-location queries have no name, so fall back to a bare "헬스장"
        // and let the radius filter drop anything not actually near the user.
        if (parsedLocation instanceof Location.NamedPlace named) {
            // NaverSearchService.sanitiseQuery caps the whole query at 60 chars,
            // and a place name may itself be up to 60 (Location.MAX_NAME_LENGTH).
            // Trim the name so the load-bearing " 근처 헬스장" suffix always survives
            // — otherwise a very long name would truncate it off and Naver would
            // return nothing, the exact failure this normalisation prevents.
            String suffix = " 근처 헬스장";
            int maxNameLen = NAVER_QUERY_MAX_LENGTH - suffix.length();
            String name = named.name();
            String trimmedName = name.length() > maxNameLen ? name.substring(0, maxNameLen) : name;
            return trimmedName + suffix;
        }
        return "헬스장";
    }

    private String translateDslError(String code) {
        return switch (code) {
            case "gym search only" -> "헬스장 검색만 가능해요. 예, 강남역 근처 파나타 머신 3개 보유한 헬스장.";
            case "invalid input" -> "유효하지 않은 입력이에요.";
            default -> "검색을 처리할 수 없어요. 다시 시도해주세요.";
        };
    }

    private void recordBreadcrumb(String input, SearchDsl dsl, Integer totalCount, long durationMs, String outcome) {
        Breadcrumb crumb = new Breadcrumb();
        crumb.setCategory("nl_search");
        crumb.setMessage("NL search " + outcome);
        crumb.setLevel("success".equals(outcome) ? SentryLevel.INFO : SentryLevel.WARNING);
        // Security task #45: Sentry is a third-party SaaS. raw user input would
        // otherwise carry uninterned PII (addresses, employer names) outside
        // the PIPA-controlled boundary. Normalise (lowercase + collapse
        // whitespace + strip punctuation) then truncate to 50 chars so the
        // breadcrumb retains its analytic value (cohort patterns) without
        // surfacing the raw query.
        crumb.setData("input", com.ironspot.common.text.SafeEcho.truncate(
            input == null ? "" : Normaliser.normalise(input), 50));
        crumb.setData("filter_count", dsl != null ? dsl.machineFilters().size() : 0);
        crumb.setData("total_count", totalCount != null ? totalCount : 0);
        crumb.setData("duration_ms", durationMs);
        crumb.setData("outcome", outcome);
        Sentry.addBreadcrumb(crumb);
    }
}
