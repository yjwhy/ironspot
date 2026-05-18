package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dto.NlSearchRequest;
import com.ironspot.search.dto.NlSearchResponse;
import com.ironspot.search.dto.ParsedFilters;
import com.ironspot.search.llm.LlmClient;
import io.sentry.Breadcrumb;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

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
            quotaService.checkAndIncrement(principal);
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
            return new NlSearchResponse(gyms, interpretation, totalCount, parsedFilters, location);
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
        crumb.setData("input", input);
        crumb.setData("filter_count", dsl != null ? dsl.machineFilters().size() : 0);
        crumb.setData("total_count", totalCount != null ? totalCount : 0);
        crumb.setData("duration_ms", durationMs);
        crumb.setData("outcome", outcome);
        Sentry.addBreadcrumb(crumb);
    }
}
