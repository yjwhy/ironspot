package com.ironspot.auth;

import com.ironspot.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Map;

/**
 * Mints a Supabase session for a Naver-authenticated user via the GoTrue admin
 * REST API (service_role). This is the second half of the Naver-login bridge:
 * {@link NaverOAuthClient} resolves the Naver profile, then this client
 * (1) ensures a Supabase user exists for that identity and (2) generates a
 * magic-link token the mobile client redeems with {@code verifyOtp} to obtain
 * a real session — Supabase has no native Naver provider to do this directly.
 *
 * <p>Both calls go to the same Kong gateway / service_role bearer pattern as
 * {@link com.ironspot.photo.StorageService}:
 * <ol>
 *   <li>{@code POST /auth/v1/admin/users} — create the user with
 *       {@code email_confirm:true} (no email is ever sent; the account is
 *       confirmed server-side). A 422 "already registered" is swallowed so the
 *       call is idempotent for returning users.</li>
 *   <li>{@code POST /auth/v1/admin/generate_link} {@code type:magiclink} —
 *       generates (does NOT send) a magic link; we return only its
 *       {@code hashed_token} for the client's {@code verifyOtp}.</li>
 * </ol>
 *
 * <p>The {@code generate_link} response shape has shifted across GoTrue
 * versions — older returns {@code hashed_token} at the top level, newer nests
 * it under {@code properties}. {@link #parseTokenHash} accepts both.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SupabaseAuthAdminClient {

    @Value("${supabase.url}")
    private String supabaseUrl;
    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    private final WebClient webClient;

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String ERROR_MESSAGE = "네이버 로그인 처리 중 오류가 발생했습니다";

    /**
     * Create the Supabase user for this identity if absent. Idempotent: a
     * duplicate (HTTP 422 from GoTrue) is treated as success so returning
     * Naver users flow straight to {@link #generateMagicLinkTokenHash}.
     */
    public void ensureUser(String email, Map<String, Object> userMetadata) {
        try {
            post("/auth/v1/admin/users", Map.of(
                "email", email,
                "email_confirm", true,
                "user_metadata", userMetadata));
        } catch (WebClientResponseException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY
                || e.getStatusCode() == HttpStatus.CONFLICT) {
                // Already registered — expected for returning users.
                return;
            }
            log.warn("Supabase admin createUser failed: {}", e.getStatusCode());
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        } catch (RuntimeException e) {
            log.warn("Supabase admin createUser transport failure: {}", e.getMessage());
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * Generate (not send) a magic link for {@code email} and return its
     * {@code hashed_token} for the client to redeem via {@code verifyOtp}.
     */
    public String generateMagicLinkTokenHash(String email) {
        Map<?, ?> response;
        try {
            response = post("/auth/v1/admin/generate_link", Map.of(
                "type", "magiclink",
                "email", email));
        } catch (RuntimeException e) {
            log.warn("Supabase admin generate_link failed: {}", e.getMessage());
            throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
        }
        return parseTokenHash(response);
    }

    /**
     * Extract {@code hashed_token} from a {@code generate_link} response,
     * tolerating both the flat (older GoTrue) and {@code properties}-nested
     * (newer) shapes. Throws {@link BusinessException} 502 if absent so the
     * caller never returns a half-built login response to the client.
     */
    static String parseTokenHash(Map<?, ?> response) {
        if (response != null) {
            Object flat = response.get("hashed_token");
            if (flat instanceof String s && !s.isBlank()) {
                return s;
            }
            if (response.get("properties") instanceof Map<?, ?> props
                && props.get("hashed_token") instanceof String nested && !nested.isBlank()) {
                return nested;
            }
        }
        throw new BusinessException(ERROR_MESSAGE, HttpStatus.BAD_GATEWAY);
    }

    private Map<?, ?> post(String path, Map<String, Object> body) {
        return webClient.post()
            .uri(supabaseUrl + path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
            .header("apikey", serviceRoleKey)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .block(TIMEOUT);
    }
}
