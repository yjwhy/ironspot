package com.ironspot.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Security task #17 — payload for {@code POST /api/users/me/consent}.
 *
 * <p>{@code version} is the policy bundle version the user actively
 * agreed to (matches the version exposed by the app's bundled
 * {@code PRIVACY_POLICY_URL} + {@code TERMS_OF_SERVICE_URL}). Stored
 * verbatim on {@code users.consent_version} so an audit can prove
 * which text the user saw at signup.
 *
 * <p>Pattern allow-list is permissive enough for semver-style strings
 * ({@code v1.0.0}, {@code 2026-05}, etc.) but rejects free text so a
 * malformed client cannot smuggle control characters into the audit
 * record.
 */
public record RecordConsentRequest(
    @Schema(
        description = "Policy bundle version the user agreed to. Allow-list: alphanumeric, dot, hyphen.",
        requiredMode = Schema.RequiredMode.REQUIRED,
        example = "v1"
    )
    @NotBlank
    @Size(max = 32)
    @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "consent version must be alphanumeric")
    String version
) {}
