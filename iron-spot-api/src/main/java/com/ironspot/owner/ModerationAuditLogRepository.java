package com.ironspot.owner;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

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
}
