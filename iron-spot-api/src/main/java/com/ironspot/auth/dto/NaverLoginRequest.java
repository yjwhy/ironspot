package com.ironspot.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body for {@code POST /api/auth/naver}. The mobile client performs the Naver
 * authorization-code redirect (Supabase has no native Naver provider) and posts
 * the resulting {@code code} plus the anti-CSRF {@code state} it generated, so
 * the backend can exchange them and mint a Supabase session.
 */
public record NaverLoginRequest(
    @NotBlank String code,
    @NotBlank String state
) {}
