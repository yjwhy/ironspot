package com.ironspot.owner;

import com.ironspot.auth.UserRepository;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.owner.dto.OwnerClaimResponse;
import com.ironspot.owner.dto.VerificationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static com.ironspot.jooq.Tables.GYMS;

/**
 * Owner claim orchestrator (Task 47 / ADR 0023). Coordinates verification,
 * persistence, role promotion, audit log, and Slack notification in a single
 * transaction so a partial failure (e.g., audit_log insert error) rolls back
 * the gym_owners insert and the role update.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OwnerService {

    static final String ACTION_OWNER_GRANTED = "owner_granted";
    static final String ACTION_OWNER_DISPUTED = "owner_disputed";
    static final String ACTION_OWNER_FAILED = "owner_failed";
    static final String TARGET_TYPE_GYM = "gym";

    private final DSLContext dsl;
    private final BusinessRegistrationVerifier verifier;
    private final GymOwnerRepository gymOwnerRepository;
    private final ModerationAuditLogRepository auditLog;
    private final UserRepository userRepository;
    private final AdminNotificationService notifier;
    private final OwnerClaimQuotaService claimQuota;

    /**
     * Verify a 사업자등록증 photo against a target gym and grant owner role
     * on success.
     *
     * @param userId       authenticated user submitting the claim
     * @param gymId        gym the user is claiming ownership of
     * @param imageBytes   사업자등록증 photo bytes (in-memory; never persisted)
     * @param consentGiven user explicitly checked PIPA consent — required
     * @return claim outcome (verified / disputed / failed)
     */
    @Transactional
    public OwnerClaimResponse claim(UUID userId, UUID gymId, byte[] imageBytes, boolean consentGiven) {
        if (!consentGiven) {
            return OwnerClaimResponse.failed("개인정보 처리에 동의해야 owner 인증을 진행할 수 있어요.");
        }

        // Security A6: owner-claim path runs Vision OCR directly, bypassing
        // PhotoService.enforceVisionQuota. A per-user daily claim cap closes
        // the hole — legitimate owners verify once per gym, so 5/day is plenty.
        claimQuota.enforce(userId);

        // Security A12: SELECT ... FOR UPDATE on the gym row so concurrent
        // owner claims for the same gym serialise. Without this lock the
        // co-owner-vs-dispute branch in handleVerified races — two
        // simultaneous claimants both see an empty gym_owners table and
        // both fall through the "first claim" path, even when their
        // business_number_hashes differ. The FOR UPDATE makes the second
        // claim wait for the first to commit, so handleVerified sees the
        // committed hash and routes the mismatch to dispute.
        //
        // Read-only paths (map search, gym detail) use plain SELECT and
        // do NOT block on this row lock — only other FOR UPDATE / UPDATE
        // / DELETE on the same row do. Owner claims are rare so the
        // serialisation window is brief.
        String gymName = dsl.select(GYMS.NAME)
            .from(GYMS)
            .where(GYMS.ID.eq(gymId))
            .forUpdate()
            .fetchOptional(r -> r.get(GYMS.NAME))
            .orElse(null);
        if (gymName == null) {
            return OwnerClaimResponse.failed("매장을 찾을 수 없어요. 다시 선택해 주세요.");
        }

        VerificationResult result = verifier.verify(imageBytes, gymName);
        return switch (result) {
            case VerificationResult.Verified v -> handleVerified(userId, gymId, v);
            case VerificationResult.Disputed d -> handleDisputed(userId, gymId, d);
            case VerificationResult.Failed f -> handleFailed(userId, gymId, f);
        };
    }

    private OwnerClaimResponse handleVerified(UUID userId, UUID gymId, VerificationResult.Verified v) {
        // Co-owner auto-allow: same business hash on the same gym is a sibling
        // owner of the same legal entity — no dispute needed. Different hash on
        // the same gym is a disputed scenario, but that's only detected on the
        // SECOND claim; the first claim sets the hash unconditionally.
        var existingHash = gymOwnerRepository.existingBusinessHashForGym(gymId);
        if (existingHash.isPresent() && !existingHash.get().equals(v.businessNumberHash())) {
            // Different business already owns this gym → escalate
            return persistDisputed(userId, gymId,
                "이 매장은 이미 다른 사업자가 소유 인증을 마쳤어요. admin 이 검토 중이에요.",
                v);
        }

        gymOwnerRepository.insertActive(gymId, userId, v.businessNumberHash());
        userRepository.promoteToOwner(userId);
        auditLog.log(userId, ACTION_OWNER_GRANTED, TARGET_TYPE_GYM, gymId, null);
        notifier.notifyOwnerVerified(gymId, userId);
        return OwnerClaimResponse.verified(gymId);
    }

    private OwnerClaimResponse handleDisputed(UUID userId, UUID gymId, VerificationResult.Disputed d) {
        return persistDisputed(userId, gymId, d.reason(), null);
    }

    private OwnerClaimResponse persistDisputed(UUID userId, UUID gymId, String reason,
                                                VerificationResult.Verified maybeVerified) {
        auditLog.log(userId, ACTION_OWNER_DISPUTED, TARGET_TYPE_GYM, gymId, null);
        notifier.notifyOwnerDisputed(gymId, userId, reason);
        return OwnerClaimResponse.disputed(reason);
    }

    private OwnerClaimResponse handleFailed(UUID userId, UUID gymId, VerificationResult.Failed f) {
        // Failed = OCR/registry could not confirm; no DB state change.
        auditLog.log(userId, ACTION_OWNER_FAILED, TARGET_TYPE_GYM, gymId, null);
        return OwnerClaimResponse.failed(f.reason());
    }
}
