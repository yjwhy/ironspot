package com.ironspot.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Result of the Naver-login bridge. The client redeems {@link #tokenHash} via
 * {@code supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })} to obtain
 * a real Supabase session — the backend never returns Supabase access/refresh
 * tokens directly. {@link #email} is the resolved (possibly synthetic) account
 * email, returned for display/diagnostics only.
 */
public record NaverLoginResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Single-use magic-link token hash; redeem with supabase.auth.verifyOtp")
    String tokenHash,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Resolved Supabase account email (synthetic when Naver omits email)")
    String email,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"magiclink"},
        description = "verifyOtp type the client must pass")
    String type
) {}
