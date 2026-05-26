package com.ironspot.owner;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

import static com.ironspot.jooq.Tables.MODERATION_AUDIT_LOG;

/**
 * moderation_audit_log inserts (Task 47 / ADR 0023 Q4 C2). Owner moderation
 * actions append a row; admin post-hoc reads for abuse detection.
 */
@Repository
@RequiredArgsConstructor
public class ModerationAuditLogRepository {

    private final DSLContext dsl;

    /**
     * Append an audit row. {@code metadataJson} may be null when the action
     * carries no structured context.
     */
    public void log(UUID userId, String action, String targetType, UUID targetId, String metadataJson) {
        dsl.insertInto(MODERATION_AUDIT_LOG)
            .set(MODERATION_AUDIT_LOG.USER_ID, userId)
            .set(MODERATION_AUDIT_LOG.ACTION, action)
            .set(MODERATION_AUDIT_LOG.TARGET_TYPE, targetType)
            .set(MODERATION_AUDIT_LOG.TARGET_ID, targetId)
            .set(MODERATION_AUDIT_LOG.METADATA, metadataJson == null ? null : JSONB.valueOf(metadataJson))
            .execute();
    }

    /**
     * Check whether an audit row with the given action/target/user already
     * exists. Used to prevent a reporter from re-escalating the same report
     * more than once (Task 47 / ADR 0023 Q5 R1).
     */
    public boolean exists(UUID userId, String action, String targetType, UUID targetId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(MODERATION_AUDIT_LOG)
                .where(MODERATION_AUDIT_LOG.USER_ID.eq(userId))
                .and(MODERATION_AUDIT_LOG.ACTION.eq(action))
                .and(MODERATION_AUDIT_LOG.TARGET_TYPE.eq(targetType))
                .and(MODERATION_AUDIT_LOG.TARGET_ID.eq(targetId)));
    }

    /**
     * Security B1: count a user's audit rows for the given actions since a
     * cutoff. {@link OwnerClaimQuotaService} uses this to enforce the
     * owner-claim daily cap from a durable source — every claim that
     * passes the quota gate writes exactly one audit row
     * (owner_granted / owner_disputed / owner_failed), so the row count is
     * the claim count. Unlike the previous in-process Caffeine counter,
     * this survives a Render redeploy / cold restart, closing the
     * deploy-timing window where an attacker could reset their quota.
     */
    public int countByUserAndActionsSince(UUID userId, Set<String> actions, OffsetDateTime since) {
        Integer count = dsl.selectCount()
            .from(MODERATION_AUDIT_LOG)
            .where(MODERATION_AUDIT_LOG.USER_ID.eq(userId))
            .and(MODERATION_AUDIT_LOG.ACTION.in(actions))
            .and(MODERATION_AUDIT_LOG.CREATED_AT.ge(since))
            .fetchOne(0, Integer.class);
        return count == null ? 0 : count;
    }
}
