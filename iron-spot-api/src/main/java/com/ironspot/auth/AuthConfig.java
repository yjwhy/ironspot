package com.ironspot.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@Configuration
public class AuthConfig {

    private static final String JWKS_SUFFIX = "/.well-known/jwks.json";

    /**
     * Wires the production {@link JwtDecoder} bean against Supabase's JWKS
     * endpoint. NimbusJwtDecoder fetches the JWKS document on first use and
     * caches the keys in-process, so per-request verification stays a local
     * crypto op. The decoder is injected into {@link JwtValidator}, which keeps
     * tests free of HTTP fixtures by accepting the JwtDecoder interface.
     *
     * <p>Defence in depth: the default Nimbus decoder only checks the signature
     * and {@code exp}. We additionally validate {@code iss} against the
     * project-specific issuer URL (derived from the JWKS URL by stripping the
     * standard {@code /.well-known/jwks.json} suffix). This blocks tokens
     * signed by a different Supabase project that happen to ride the same JWKS
     * host. The {@code aud} claim is validated separately in
     * {@link JwtValidator#validate} because Nimbus's audience validator pulls
     * from {@code spring.security.oauth2.resourceserver.jwt.audiences} which
     * we deliberately do not configure (the value is invariant per Supabase).
     */
    @Bean
    public JwtDecoder supabaseJwtDecoder(@Value("${security.supabase-jwks-url}") String jwksUrl) {
        if (jwksUrl == null || jwksUrl.isBlank()) {
            throw new IllegalStateException(
                "SUPABASE_JWKS_URL must be set — Supabase JWKS endpoint, "
                    + "e.g. https://<project>.supabase.co/auth/v1/.well-known/jwks.json");
        }
        String issuer = deriveIssuer(jwksUrl);
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUrl)
            .jwsAlgorithm(SignatureAlgorithm.ES256)
            .jwsAlgorithm(SignatureAlgorithm.RS256)
            .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
        return decoder;
    }

    /**
     * Derives the Supabase issuer URL from the JWKS URL by stripping the
     * standard {@code /.well-known/jwks.json} suffix. Supabase issues all
     * tokens with {@code iss = https://<project>.supabase.co/auth/v1}.
     * Package-private for unit-test access.
     */
    static String deriveIssuer(String jwksUrl) {
        if (jwksUrl == null || !jwksUrl.endsWith(JWKS_SUFFIX)) {
            throw new IllegalStateException(
                "SUPABASE_JWKS_URL must end with '" + JWKS_SUFFIX + "', got: " + jwksUrl);
        }
        return jwksUrl.substring(0, jwksUrl.length() - JWKS_SUFFIX.length());
    }
}
