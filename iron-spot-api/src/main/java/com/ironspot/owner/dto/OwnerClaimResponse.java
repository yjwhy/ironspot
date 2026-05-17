package com.ironspot.owner.dto;

import java.util.UUID;

/**
 * Response from {@code POST /api/owner/claim}. Status drives the FE flow:
 * <ul>
 *   <li>{@code VERIFIED} — owner role granted, navigate to /owner/queue</li>
 *   <li>{@code DISPUTED} — admin review queued (24h SLA), show pending UI</li>
 *   <li>{@code FAILED}   — show retry prompt with reason</li>
 * </ul>
 *
 * @param status  one of VERIFIED / DISPUTED / FAILED
 * @param message user-visible Korean message
 * @param gymId   when VERIFIED, the gym the user is now owner of
 */
public record OwnerClaimResponse(
    String status,
    String message,
    UUID gymId
) {
    public static final String STATUS_VERIFIED = "VERIFIED";
    public static final String STATUS_DISPUTED = "DISPUTED";
    public static final String STATUS_FAILED = "FAILED";

    public static OwnerClaimResponse verified(UUID gymId) {
        return new OwnerClaimResponse(
            STATUS_VERIFIED,
            "인증 완료! 내 매장 관리를 시작할 수 있어요.",
            gymId);
    }

    public static OwnerClaimResponse disputed(String reason) {
        return new OwnerClaimResponse(STATUS_DISPUTED, reason, null);
    }

    public static OwnerClaimResponse failed(String reason) {
        return new OwnerClaimResponse(STATUS_FAILED, reason, null);
    }
}
