package com.ironspot.search;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dto.NlSearchRequest;
import com.ironspot.search.dto.NlSearchResponse;
import com.ironspot.search.llm.LlmClient;
import io.sentry.Breadcrumb;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NlSearchService {

    private final LlmClient llmClient;
    private final DslValidator dslValidator;
    private final LocationResolver locationResolver;
    private final SqlBuilder sqlBuilder;
    private final InterpretationFormatter interpretationFormatter;

    @Transactional(readOnly = true)
    public NlSearchResponse search(NlSearchRequest req) {
        long startNanos = System.nanoTime();
        SearchDsl dsl = null;
        Integer totalCount = null;
        String outcome = "success";
        try {
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
            return new NlSearchResponse(gyms, interpretation, totalCount);
        } catch (BusinessException e) {
            if ("success".equals(outcome)) outcome = "business_error:" + e.getStatus().value();
            throw e;
        } catch (RuntimeException e) {
            outcome = "runtime_error";
            throw e;
        } finally {
            long durationMs = (System.nanoTime() - startNanos) / 1_000_000L;
            recordBreadcrumb(req.query(), dsl, totalCount, durationMs, outcome);
        }
    }

    private String translateDslError(String code) {
        return switch (code) {
            case "gym search only" -> "헬스장 검색만 가능해요. 예: 강남역 근처 헬스장";
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
