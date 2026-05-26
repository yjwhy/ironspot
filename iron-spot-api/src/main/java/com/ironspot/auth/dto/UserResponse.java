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

    /**
     * Security A4 — account-deletion grace window. When the user has
     * requested deletion, this carries the ISO-8601 timestamp of the
     * request; the row will be permanently anonymised 7 days after this
     * timestamp by {@code AccountDeletionFinaliserJob}. The FE shows
     * a "삭제 예정 — 취소하시겠어요?" banner whenever this is non-null
     * and offers {@code POST /api/users/me/cancel-deletion} to revert.
     * Null on active accounts.
     */
    @Schema(description = "Pending-deletion request timestamp (ISO-8601). Null on active accounts.")
    private String deletionRequestedAt;
}
