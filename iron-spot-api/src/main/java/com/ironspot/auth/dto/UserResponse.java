package com.ironspot.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserResponse {
    private String id;
    private String email;
    private String nickname;
    private String createdAt;

    @Schema(allowableValues = {"user", "admin", "owner"})
    private String role;

    /**
     * Security task #17 — PIPA active-consent timestamp. Null for users
     * created before V19 (or new users between OAuth success and the
     * consent endpoint call). The app shows the consent gate when this
     * is null and skips it otherwise.
     */
    @Schema(description = "PIPA consent timestamp (ISO-8601). Null if not yet recorded.")
    private String consentAcceptedAt;

    @Schema(description = "Policy bundle version the user accepted. Null if not yet recorded.")
    private String consentVersion;
}
