package com.ironspot.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Validates Supabase Auth JWTs and lifts them into the application's UserPrincipal.
 *
 * <p>Crypto verification (signature + expiry + issuer) is delegated to the
 * injected {@link JwtDecoder}, which {@link AuthConfig} wires as a JWKS-backed
 * NimbusJwtDecoder pointing at the Supabase project's
 * {@code /auth/v1/.well-known/jwks.json} endpoint. Supabase rotated all
 * projects from legacy HS256 shared secrets to ECC P-256 signing keys, so
 * HMAC verification no longer matches new tokens.
 *
 * <p>This class adds three application-level claim checks on top of Nimbus:
 * <ol>
 *   <li>{@code sub} must be a UUID (Supabase user id format).</li>
 *   <li>{@code email} must be present and non-blank.</li>
 *   <li>{@code aud} must contain {@value #REQUIRED_AUDIENCE}. Supabase emits
 *       end-user session tokens with this audience; service_role / anon
 *       tokens carry different audiences and are server-only — they must not
 *       authenticate as a user.</li>
 * </ol>
 *
 * <p>Constructor accepts the {@link JwtDecoder} interface (not the concrete
 * Nimbus implementation) so tests can mock the decoder and drive the
 * validation branches directly without standing up a JWKS HTTP fixture.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtValidator {

    /**
     * Required value of the {@code aud} claim for end-user session tokens.
     * Supabase invariant — do not configure via property.
     */
    private static final String REQUIRED_AUDIENCE = "authenticated";

    private final JwtDecoder decoder;
    private final UserRepository userRepository;

    public Optional<UserPrincipal> validate(String token) {
        try {
            Jwt jwt = decoder.decode(token);

            String sub = jwt.getSubject();
            try {
                UUID.fromString(sub);
            } catch (IllegalArgumentException e) {
                log.debug("JWT sub is not a UUID: {}", sub);
                return Optional.empty();
            }

            String email = jwt.getClaimAsString("email");
            if (email == null || email.isBlank()) {
                log.debug("JWT missing email claim for sub={}", sub);
                return Optional.empty();
            }

            List<String> audiences = jwt.getAudience();
            if (audiences == null || !audiences.contains(REQUIRED_AUDIENCE)) {
                log.debug("JWT missing required aud={} for sub={}, got: {}",
                    REQUIRED_AUDIENCE, sub, audiences);
                return Optional.empty();
            }

            UserAuthContext ctx = userRepository.findAuthContext(sub)
                .orElse(new UserAuthContext("user", null));

            return Optional.of(UserPrincipal.builder()
                .userId(sub)
                .email(email)
                .role(ctx.role())
                .bannedAt(ctx.bannedAt())
                .build());
        } catch (JwtException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
