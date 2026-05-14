package com.ironspot.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@Configuration
public class AuthConfig {

    /**
     * Wires the production {@link JwtDecoder} bean against Supabase's JWKS
     * endpoint. NimbusJwtDecoder fetches the JWKS document on first use and
     * caches the keys in-process, so per-request verification stays a local
     * crypto op. The decoder is injected into {@link JwtValidator}, which keeps
     * tests free of HTTP fixtures by accepting the JwtDecoder interface.
     */
    @Bean
    public JwtDecoder supabaseJwtDecoder(@Value("${security.supabase-jwks-url}") String jwksUrl) {
        if (jwksUrl == null || jwksUrl.isBlank()) {
            throw new IllegalStateException(
                "SUPABASE_JWKS_URL must be set — Supabase JWKS endpoint, "
                    + "e.g. https://<project>.supabase.co/auth/v1/.well-known/jwks.json");
        }
        return NimbusJwtDecoder.withJwkSetUri(jwksUrl)
      .jwsAlgorithm(SignatureAlgorithm.ES256)
      .jwsAlgorithm(SignatureAlgorithm.RS256)
      .build();
    }
}
