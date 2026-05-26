package com.ironspot.auth;

import com.ironspot.auth.dto.NaverProfile;
import com.ironspot.common.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.Map;

/**
 * Server-side half of the Naver-login bridge. Supabase Auth has no native
 * Naver provider (unlike Kakao/Google/Apple), so the mobile client performs the
 * Naver authorization-code redirect and hands the {@code code} to the backend;
 * this client exchanges it for a Naver session and resolves the user's profile.
 * {@code NaverLoginService} then mints a Supabase session from the profile.
 *
 * <p>Two outbound GET calls (Naver's token endpoint accepts the params on the
 * query string, matching {@link com.ironspot.gym.NaverSearchService}'s style):
 * <ol>
 *   <li>{@code https://nid.naver.com/oauth2.0/token} — authorization_code →
 *       {@code access_token}.</li>
 *   <li>{@code https://openapi.naver.com/v1/nid/me} — Bearer access_token →
 *       {@code response.{id,email,name}}.</li>
 * </ol>
 *
 * <p>All failures (transport, missing token, missing id) surface as a
 * {@link BusinessException} with a Korean user-facing message and HTTP 502, so
 * the controller returns a clean error rather than leaking Naver internals.
 *
 * <p>Naver-login credentials are a <em>separate</em> Naver application from the
 * 지역검색 (maps) credentials in {@code naver.search.*}; do not reuse them.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NaverOAuthClient {

    @Value("${naver.login.client-id:}")
    private String clientId;
    @Value("${naver.login.client-secret:}")
    private String clientSecret;

    private final WebClient webClient;

    private static final String TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
    private static final String PROFILE_URL = "https://openapi.naver.com/v1/nid/me";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String ERROR_MESSAGE = "네이버 로그인에 실패했습니다";

    @PostConstruct
    void validateConfig() {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            log.warn("NAVER_CLIENT_ID/SECRET not configured — Naver login will fail at runtime");
        }
    }

    /**
     * Exchange the authorization {@code code} (with its anti-CSRF {@code state})
     * for the user's Naver profile. {@link NaverProfile#email()} may be null
     * when the email scope has not yet passed Naver 검수.
     */
    public NaverProfile exchangeCodeForProfile(String code, String state) {
        String accessToken = exchangeCodeForAccessToken(code, state);
        return fetchProfile(accessToken);
    }

    private String exchangeCodeForAccessToken(String code, String state) {
        URI uri = UriComponentsBuilder.fromUriString(TOKEN_URL)
            .queryParam("grant_type", "authorization_code")
            .queryParam("client_id", clientId)
            .queryParam("client_secret", clientSecret)
            .queryParam("code", code)
            .queryParam("state", state)
            .build()
            .encode()
            .toUri();

        Map<?, ?> response = getJson(uri, null);
        Object accessToken = response != null ? response.get("access_token") : null;
        if (accessToken == null || accessToken.toString().isBlank()) {
            log.warn("Naver token exchange returned no access_token (keys={})",
                response != null ? response.keySet() : "null");
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
        return accessToken.toString();
    }

    private NaverProfile fetchProfile(String accessToken) {
        URI uri = URI.create(PROFILE_URL);
        Map<?, ?> body = getJson(uri, accessToken);

        Object responseObj = body != null ? body.get("response") : null;
        if (!(responseObj instanceof Map<?, ?> profile)) {
            log.warn("Naver profile fetch missing response object (resultcode={})",
                body != null ? body.get("resultcode") : "null");
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        }

        Object id = profile.get("id");
        if (id == null || id.toString().isBlank()) {
            log.warn("Naver profile missing id");
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        }

        return new NaverProfile(
            id.toString(),
            blankToNull(asString(profile.get("email"))),
            blankToNull(asString(profile.get("name"))));
    }

    private Map<?, ?> getJson(URI uri, String bearerToken) {
        try {
            return webClient.get()
                .uri(uri)
                .headers(h -> {
                    h.set(HttpHeaders.ACCEPT, "application/json");
                    if (bearerToken != null) {
                        h.set(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken);
                    }
                })
                .retrieve()
                .bodyToMono(Map.class)
                .block(TIMEOUT);
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            log.warn("Naver login API call failed: {}", e.getMessage());
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
    }

    private static String asString(Object value) {
        return value == null ? "" : value.toString();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
