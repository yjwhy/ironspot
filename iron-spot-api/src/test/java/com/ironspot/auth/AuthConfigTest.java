package com.ironspot.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit-level coverage of {@link AuthConfig#deriveIssuer} — the issuer URL
 * derivation that powers the new iss claim validator. The JwtDecoder bean
 * itself is exercised end-to-end through controller tests where a mock
 * {@link org.springframework.security.oauth2.jwt.JwtDecoder} stands in for
 * Nimbus.
 */
class AuthConfigTest {

    @Test
    void deriveIssuerStripsJwksSuffix() {
        String jwksUrl = "https://abc.supabase.co/auth/v1/.well-known/jwks.json";

        assertThat(AuthConfig.deriveIssuer(jwksUrl))
            .isEqualTo("https://abc.supabase.co/auth/v1");
    }

    @Test
    void deriveIssuerRejectsUrlWithoutJwksSuffix() {
        assertThatThrownBy(() -> AuthConfig.deriveIssuer("https://abc.supabase.co/auth/v1"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("/.well-known/jwks.json");
    }

    @Test
    void deriveIssuerRejectsEmptyString() {
        assertThatThrownBy(() -> AuthConfig.deriveIssuer(""))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void deriveIssuerRejectsNull() {
        assertThatThrownBy(() -> AuthConfig.deriveIssuer(null))
            .isInstanceOf(IllegalStateException.class);
    }
}
