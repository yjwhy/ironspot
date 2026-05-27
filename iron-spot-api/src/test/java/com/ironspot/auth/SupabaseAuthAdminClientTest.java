package com.ironspot.auth;

import com.ironspot.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Targets {@link SupabaseAuthAdminClient#parseTokenHash} — the
 * version-tolerant extraction of the magic-link {@code hashed_token}. HTTP
 * wiring (createUser idempotency, generate_link call) is exercised live once
 * Supabase credentials are present, matching how the other external clients
 * (Naver search, LLM) verify their transport.
 */
class SupabaseAuthAdminClientTest {

    @Test
    void parsesFlatHashedToken() {
        Map<String, Object> response = Map.of(
            "hashed_token", "flat-token-abc",
            "verification_type", "magiclink");

        assertThat(SupabaseAuthAdminClient.parseTokenHash(response)).isEqualTo("flat-token-abc");
    }

    @Test
    void parsesNestedPropertiesHashedToken() {
        Map<String, Object> response = Map.of(
            "user", Map.of("id", "uuid-1"),
            "properties", Map.of(
                "hashed_token", "nested-token-xyz",
                "action_link", "https://x/verify"));

        assertThat(SupabaseAuthAdminClient.parseTokenHash(response)).isEqualTo("nested-token-xyz");
    }

    @Test
    void prefersFlatOverNestedWhenBothPresent() {
        Map<String, Object> response = Map.of(
            "hashed_token", "flat-wins",
            "properties", Map.of("hashed_token", "nested-loses"));

        assertThat(SupabaseAuthAdminClient.parseTokenHash(response)).isEqualTo("flat-wins");
    }

    @Test
    void throwsWhenNoTokenAnywhere() {
        Map<String, Object> response = Map.of(
            "user", Map.of("id", "uuid-1"),
            "properties", Map.of("action_link", "https://x/verify"));

        assertThatThrownBy(() -> SupabaseAuthAdminClient.parseTokenHash(response))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("네이버");
    }

    @Test
    void throwsWhenResponseNull() {
        assertThatThrownBy(() -> SupabaseAuthAdminClient.parseTokenHash(null))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void throwsWhenHashedTokenBlank() {
        Map<String, Object> response = new HashMap<>();
        response.put("hashed_token", "  ");

        assertThatThrownBy(() -> SupabaseAuthAdminClient.parseTokenHash(response))
            .isInstanceOf(BusinessException.class);
    }
}
