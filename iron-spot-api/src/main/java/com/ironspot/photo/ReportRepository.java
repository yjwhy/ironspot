package com.ironspot.photo;

import com.ironspot.admin.dto.AdminQueuePhotoSummary;
import com.ironspot.admin.dto.AdminReportResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.REPORTS;

@Repository
@RequiredArgsConstructor
public class ReportRepository {

    public static final String TARGET_TYPE_PHOTO = "photo";
    public static final String TARGET_TYPE_GYM_MACHINE = "gym_machine";
    static final String STATUS_PENDING = "pending";

    public enum InsertResult { INSERTED, ESCALATED, DUPLICATE }

    private final DSLContext dsl;

    /**
     * Insert a new report, or escalate an existing one if the new reason is urgent
     * and the existing reason is not. UNIQUE on (user_id, target_id) means a single
     * user can have at most one row per target; escalation overwrites reason/detail
     * in place rather than inserting a second row.
     * <p>
     * ADR 0022 follow-up (Task 46): {@code targetType} is now an explicit parameter
     * — photo callers pass {@link #TARGET_TYPE_PHOTO}, gym_machine callers pass
     * {@link #TARGET_TYPE_GYM_MACHINE}. Escalation (LEGAL_PERSONAL upgrade) only
     * applies on the photo surface — gym_machine reasons never escalate.
     */
    public InsertResult insertOrEscalate(
            UUID userId, String targetType, UUID targetId, ReportReason reason, String detail) {
        int inserted = dsl.insertInto(REPORTS)
            .set(REPORTS.USER_ID, userId)
            .set(REPORTS.TARGET_TYPE, targetType)
            .set(REPORTS.TARGET_ID, targetId)
            .set(REPORTS.REASON, reason.name())
            .set(REPORTS.DETAIL, detail)
            .onConflict(REPORTS.USER_ID, REPORTS.TARGET_ID)
            .doNothing()
            .execute();
        if (inserted > 0) return InsertResult.INSERTED;

        if (TARGET_TYPE_PHOTO.equals(targetType) && reason == ReportReason.LEGAL_PERSONAL) {
            int escalated = dsl.update(REPORTS)
                .set(REPORTS.REASON, reason.name())
                .set(REPORTS.DETAIL, detail)
                .where(REPORTS.USER_ID.eq(userId))
                .and(REPORTS.TARGET_ID.eq(targetId))
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

    /**
     * Photo-grouped admin queue: one row per photo with at least one pending report,
     * aggregating pending count, oldest report timestamp, and most-common reason.
     * The {@code target_type = 'photo'} filter is defensive — future report types
     * (gym_machine, user) must not leak into the photo moderation surface.
     */
    public List<AdminQueuePhotoSummary> listPendingPhotoQueue(int limit) {
        Field<Integer> pendingCount = DSL.count(REPORTS.ID).as("pending_count");
        Field<OffsetDateTime> oldestReportAt = DSL.min(REPORTS.CREATED_AT).as("oldest_report_at");
        Field<String> topReason = DSL.field(
            "mode() WITHIN GROUP (ORDER BY {0})", String.class, REPORTS.REASON
        ).as("top_reason");

        return dsl.select(MACHINE_PHOTOS.ID, MACHINE_PHOTOS.PHOTO_URL,
                pendingCount, oldestReportAt, topReason)
            .from(MACHINE_PHOTOS)
            .join(REPORTS).on(REPORTS.TARGET_ID.eq(MACHINE_PHOTOS.ID))
            .where(REPORTS.STATUS.eq(STATUS_PENDING))
            .and(REPORTS.TARGET_TYPE.eq(TARGET_TYPE_PHOTO))
            .groupBy(MACHINE_PHOTOS.ID, MACHINE_PHOTOS.PHOTO_URL)
            .orderBy(oldestReportAt.asc())
            .limit(limit)
            .fetch(r -> new AdminQueuePhotoSummary(
                r.get(MACHINE_PHOTOS.ID),
                r.get(MACHINE_PHOTOS.PHOTO_URL),
                r.get(pendingCount),
                r.get(oldestReportAt),
                r.get(topReason)
            ));
    }

    public List<AdminReportResponse> findByTargetIdAndStatus(UUID targetId, String status) {
        return dsl.select(
                REPORTS.ID, REPORTS.USER_ID, REPORTS.TARGET_TYPE, REPORTS.TARGET_ID,
                REPORTS.REASON, REPORTS.DETAIL, REPORTS.STATUS,
                REPORTS.DISPOSED_BY, REPORTS.DISPOSED_AT, REPORTS.CREATED_AT)
            .from(REPORTS)
            .where(REPORTS.TARGET_ID.eq(targetId))
            .and(REPORTS.STATUS.eq(status))
            .and(REPORTS.TARGET_TYPE.eq(TARGET_TYPE_PHOTO))
            .orderBy(REPORTS.CREATED_AT.asc())
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

    /**
     * Count actioned reports across all photos uploaded by the given user. Drives the
     * uploader auto-ban cascade in {@link com.ironspot.admin.AdminService}.
     */
    public int countActionedByUploader(UUID uploaderId) {
        Integer count = dsl.selectCount()
            .from(REPORTS)
            .join(MACHINE_PHOTOS).on(MACHINE_PHOTOS.ID.eq(REPORTS.TARGET_ID))
            .where(REPORTS.STATUS.eq("actioned"))
            .and(REPORTS.TARGET_TYPE.eq(TARGET_TYPE_PHOTO))
            .and(MACHINE_PHOTOS.USER_ID.eq(uploaderId))
            .fetchOneInto(Integer.class);
        return Objects.requireNonNullElse(count, 0);
    }

    /**
     * Count dismissed reports filed by the given reporter. Drives the reporter
     * auto-ban cascade (false-report abuse defence).
     */
    public int countDismissedByReporter(UUID reporterId) {
        Integer count = dsl.selectCount()
            .from(REPORTS)
            .where(REPORTS.STATUS.eq("dismissed"))
            .and(REPORTS.USER_ID.eq(reporterId))
            .fetchOneInto(Integer.class);
        return Objects.requireNonNullElse(count, 0);
    }
}
