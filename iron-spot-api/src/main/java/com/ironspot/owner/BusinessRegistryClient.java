package com.ironspot.owner;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Client for 국세청 사업자등록정보 진위확인 API (공공데이터포털).
 *
 * <p>API spec: https://www.data.go.kr/data/15081808/openapi.do
 * <p>Endpoint: POST {base-url}/api/nts-businessman/v1/validate?serviceKey={URL-encoded key}
 *
 * <p>Request body shape:
 * <pre>{@code
 * { "businesses": [ { "b_no": "1234567890", "start_dt": "20200101", "p_nm": "홍길동", "b_nm": "주식회사 분당짐" } ] }
 * }</pre>
 *
 * <p>Response body shape (relevant fields):
 * <pre>{@code
 * { "match_cnt": 1, "data": [ { "b_no": "1234567890", "valid": "01", "valid_msg": "확인된 사업자" } ] }
 * }</pre>
 *
 * <p>valid="01" means the 4-tuple (b_no, start_dt, p_nm, b_nm) matches the
 * 국세청 record. Any other value (or absence of data) means invalid.
 *
 * <p>Failure modes:
 * <ul>
 *   <li>API key missing/empty — {@link #validate} returns false, log warn. Verifier falls through to Disputed.</li>
 *   <li>Network timeout / 5xx — returns false, log warn.</li>
 *   <li>Service key invalid (401/403) — returns false, log warn.</li>
 * </ul>
 *
 * <p>Note: this client never throws; verification is fail-closed (invalid → no auto-grant).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BusinessRegistryClient {

    private static final String VALIDATE_PATH = "/api/nts-businessman/v1/validate";
    private static final String VALID_FLAG = "01";
    private static final Duration CALL_TIMEOUT = Duration.ofSeconds(8);

    @Value("${nts.business.base-url}")
    private String baseUrl;

    @Value("${nts.business.api-key}")
    private String apiKey;

    private final WebClient webClient;

    @PostConstruct
    void validateKey() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("NTS_BUSINESS_API_KEY is not configured — owner claim verification will always return false (admin escalation path)");
        }
    }

    /**
     * Validate the 4-tuple against 국세청 record.
     *
     * @param businessNumber 10-digit 사업자등록번호, hyphens stripped
     * @param startDate      개업일 YYYYMMDD
     * @param representative 대표자명
     * @param businessName   상호
     * @return true iff API returns valid="01" for the tuple
     */
    @SuppressWarnings("unchecked")
    public boolean validate(String businessNumber, String startDate, String representative, String businessName) {
        if (apiKey == null || apiKey.isBlank()) return false;
        if (businessNumber == null || businessNumber.isBlank()) return false;

        Map<String, Object> requestBody = Map.of(
            "businesses", List.of(Map.of(
                "b_no", businessNumber,
                "start_dt", nullToEmpty(startDate),
                "p_nm", nullToEmpty(representative),
                "b_nm", nullToEmpty(businessName)
            ))
        );

        try {
            String uri = baseUrl + VALIDATE_PATH + "?serviceKey="
                + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
            Map<?, ?> response = webClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .block(CALL_TIMEOUT);

            if (response == null) return false;
            List<?> data = (List<?>) response.get("data");
            if (data == null || data.isEmpty()) return false;
            Map<?, ?> first = (Map<?, ?>) data.get(0);
            return VALID_FLAG.equals(first.get("valid"));
        } catch (Exception ex) {
            log.warn("NTS validate call failed for businessNumber=*** ({}): {}", maskTail(businessNumber), ex.getMessage());
            return false;
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String maskTail(String s) {
        if (s == null || s.length() < 4) return "***";
        return "***" + s.substring(s.length() - 4);
    }
}
