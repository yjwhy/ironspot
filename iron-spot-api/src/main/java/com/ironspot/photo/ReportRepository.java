package com.ironspot.photo;

import com.ironspot.admin.dto.AdminReportResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.REPORTS;

@Repository
@RequiredArgsConstructor
public class ReportRepository {

    static final String TARGET_TYPE_PHOTO = "photo";
    static final String STATUS_PENDING = "pending";

    public enum InsertResult { INSERTED, ESCALATED, DUPLICATE }

    private final DSLContext dsl;

    /**
     * Insert a new report, or escalate an existing one if the new reason is urgent
     * and the existing reason is not. UNIQUE on (user_id, target_id) means a single
     * user can have at most one row per photo; escalation overwrites reason/detail
     * in place rather than inserting a second row.
     */
    public InsertResult insertOrEscalate(UUID userId, UUID photoId, ReportReason reason, String detail) {
        int inserted = dsl.insertInto(REPORTS)
            .set(REPORTS.USER_ID, userId)
            .set(REPORTS.TARGET_TYPE, TARGET_TYPE_PHOTO)
            .set(REPORTS.TARGET_ID, photoId)
            .set(REPORTS.REASON, reason.name())
            .set(REPORTS.DETAIL, detail)
            .onConflict(REPORTS.USER_ID, REPORTS.TARGET_ID)
            .doNothing()
            .execute();
        if (inserted > 0) return InsertResult.INSERTED;

        if (reason == ReportReason.LEGAL_PERSONAL) {
            int escalated = dsl.update(REPORTS)
                .set(REPORTS.REASON, reason.name())
                .set(REPORTS.DETAIL, detail)
                .where(REPORTS.USER_ID.eq(userId))
                .and(REPORTS.TARGET_ID.eq(photoId))
                .and(REPORTS.REASON.notEqual(ReportReason.LEGAL_PERSONAL.name()))
                .execute();
            if (escalated > 0) return InsertResult.ESCALATED;
        }
        return InsertResult.DUPLICATE;
    }

    public int countPending(UUID photoId) {
        Integer count = dsl.selectCount()
            .from(REPORTS)
            .where(REPORTS.TARGET_ID.eq(photoId))
            .and(REPORTS.STATUS.eq(STATUS_PENDING))
            .fetchOneInto(Integer.class);
        return Objects.requireNonNullElse(count, 0);
    }

    public int countByReporterSince(UUID userId, OffsetDateTime since) {
        Integer count = dsl.selectCount()
            .from(REPORTS)
            .where(REPORTS.USER_ID.eq(userId))
            .and(REPORTS.CREATED_AT.greaterOrEqual(since))
            .fetchOneInto(Integer.class);
        return Objects.requireNonNullElse(count, 0);
    }

    public List<AdminReportResponse> findByStatusOrderByCreatedAtDesc(String status, int limit) {
        return dsl.select(
                REPORTS.ID, REPORTS.USER_ID, REPORTS.TARGET_TYPE, REPORTS.TARGET_ID,
                REPORTS.REASON, REPORTS.DETAIL, REPORTS.STATUS,
                REPORTS.DISPOSED_BY, REPORTS.DISPOSED_AT, REPORTS.CREATED_AT)
            .from(REPORTS)
            .where(REPORTS.STATUS.eq(status))
            .orderBy(REPORTS.CREATED_AT.desc())
            .limit(limit)
            .fetch(r -> new AdminReportResponse(
                r.get(REPORTS.ID),
                r.get(REPORTS.USER_ID),
                r.get(REPORTS.TARGET_TYPE),
                r.get(REPORTS.TARGET_ID),
                r.get(REPORTS.REASON),
                r.get(REPORTS.DETAIL),
                r.get(REPORTS.STATUS),
                r.get(REPORTS.DISPOSED_BY),
                r.get(REPORTS.DISPOSED_AT),
                r.get(REPORTS.CREATED_AT)
            ));
    }

    public Optional<AdminReportResponse> findById(UUID id) {
        return dsl.select(
                REPORTS.ID, REPORTS.USER_ID, REPORTS.TARGET_TYPE, REPORTS.TARGET_ID,
                REPORTS.REASON, REPORTS.DETAIL, REPORTS.STATUS,
                REPORTS.DISPOSED_BY, REPORTS.DISPOSED_AT, REPORTS.CREATED_AT)
            .from(REPORTS)
            .where(REPORTS.ID.eq(id))
            .fetchOptional(r -> new AdminReportResponse(
                r.get(REPORTS.ID),
                r.get(REPORTS.USER_ID),
                r.get(REPORTS.TARGET_TYPE),
                r.get(REPORTS.TARGET_ID),
                r.get(REPORTS.REASON),
                r.get(REPORTS.DETAIL),
                r.get(REPORTS.STATUS),
                r.get(REPORTS.DISPOSED_BY),
                r.get(REPORTS.DISPOSED_AT),
                r.get(REPORTS.CREATED_AT)
            ));
    }

    public boolean existsById(UUID id) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(REPORTS)
                .where(REPORTS.ID.eq(id))
        );
    }

    public int updateDisposition(UUID id, String disposition, UUID adminUserId) {
        return dsl.update(REPORTS)
            .set(REPORTS.STATUS, disposition)
            .set(REPORTS.DISPOSED_BY, adminUserId)
            .set(REPORTS.DISPOSED_AT, OffsetDateTime.now())
            .where(REPORTS.ID.eq(id))
            .and(REPORTS.STATUS.eq(STATUS_PENDING))
            .execute();
    }
}
