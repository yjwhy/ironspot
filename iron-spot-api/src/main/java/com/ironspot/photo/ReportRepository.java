package com.ironspot.photo;

import com.ironspot.admin.dto.AdminQueueItem;
import com.ironspot.admin.dto.AdminQueuePhotoSummary;
import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.owner.dto.OwnerQueueItem;
import lombok.RequiredArgsConstructor;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static com.ironspot.jooq.Tables.BRANDS;
import static com.ironspot.jooq.Tables.GYMS;
import static com.ironspot.jooq.Tables.GYM_MACHINES;
import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.MACHINE_TEMPLATES;
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

    /**
     * Lookup the latest report id filed by this reporter against this target
     * (Task 47 / ADR 0023 Q4 B3). Used immediately after insertOrEscalate to
     * stamp owner_timeout_at / apply self-gym auto-action on the row we just
     * created. Returns empty if no row exists.
     */
    public Optional<UUID> findIdByReporterAndTarget(UUID userId, UUID targetId) {
        return dsl.select(REPORTS.ID)
            .from(REPORTS)
            .where(REPORTS.USER_ID.eq(userId))
            .and(REPORTS.TARGET_ID.eq(targetId))
            .fetchOptional(r -> r.get(REPORTS.ID));
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
     * Reporter-driven escalation: re-open a previously disposed report back to
     * 'pending', clearing disposed_by/disposed_at (Task 47 / ADR 0023 Q5 R1).
     * Filters on status IN ('actioned', 'dismissed') so concurrent admin
     * touches and already-pending reports do not double-flip.
     */
    public int reopenForReporterEscalation(UUID reportId) {
        return dsl.update(REPORTS)
            .set(REPORTS.STATUS, STATUS_PENDING)
            .setNull(REPORTS.DISPOSED_BY)
            .setNull(REPORTS.DISPOSED_AT)
            .where(REPORTS.ID.eq(reportId))
            .and(REPORTS.STATUS.in("actioned", "dismissed"))
            .execute();
    }

    /**
     * Reports still inside the 24h owner window are scoped to the owner queue
     * and must NOT leak into the admin queue (Task 47 / ADR 0023 Q4 B3). Once
     * the timeout passes, the cron clears owner_timeout_at to NULL and the
     * report becomes admin-visible.
     */
    private Condition notInOwnerWindow() {
        return REPORTS.OWNER_TIMEOUT_AT.isNull()
            .or(REPORTS.OWNER_TIMEOUT_AT.lessThan(OffsetDateTime.now()));
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
            .and(notInOwnerWindow())
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

    /**
     * Unified admin moderation queue: photo + gym_machine pending reports grouped
     * by target, ordered by oldest report. ADR 0022 follow-up (Task 46).
     * <p>
     * Implemented as two grouped queries + Java merge rather than a SQL UNION
     * because the per-type label/imageUrl projections differ in joined tables
     * (machine_photos vs gym_machines × machine_templates × brands) — UNION
     * would force NULL padding the unused columns and obscure intent.
     */
    public List<AdminQueueItem> listPendingQueue(int limit) {
        List<AdminQueueItem> photo = listPendingPhotoQueueItems(limit);
        List<AdminQueueItem> gymMachine = listPendingGymMachineQueueItems(limit);
        return Stream.concat(photo.stream(), gymMachine.stream())
            .sorted(Comparator.comparing(AdminQueueItem::oldestReportAt))
            .limit(limit)
            .toList();
    }

    private List<AdminQueueItem> listPendingPhotoQueueItems(int limit) {
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
            .and(notInOwnerWindow())
            .groupBy(MACHINE_PHOTOS.ID, MACHINE_PHOTOS.PHOTO_URL)
            .orderBy(oldestReportAt.asc())
            .limit(limit)
            .fetch(r -> new AdminQueueItem(
                TARGET_TYPE_PHOTO,
                r.get(MACHINE_PHOTOS.ID),
                "사진",
                r.get(MACHINE_PHOTOS.PHOTO_URL),
                r.get(pendingCount),
                r.get(oldestReportAt),
                r.get(topReason)
            ));
    }

    private List<AdminQueueItem> listPendingGymMachineQueueItems(int limit) {
        Field<Integer> pendingCount = DSL.count(REPORTS.ID).as("pending_count");
        Field<OffsetDateTime> oldestReportAt = DSL.min(REPORTS.CREATED_AT).as("oldest_report_at");
        Field<String> topReason = DSL.field(
            "mode() WITHIN GROUP (ORDER BY {0})", String.class, REPORTS.REASON
        ).as("top_reason");
        // CONCAT with space: brandName + ' ' + templateName. NULL-safe via COALESCE
        // since gym_machines.template_id is nullable in principle (custom rows).
        Field<String> labelField = DSL.field(
            "COALESCE({0} || ' ' || {1}, '머신')",
            String.class, BRANDS.NAME, MACHINE_TEMPLATES.NAME
        ).as("label");

        return dsl.select(GYM_MACHINES.ID, labelField,
                pendingCount, oldestReportAt, topReason)
            .from(GYM_MACHINES)
            .join(REPORTS).on(REPORTS.TARGET_ID.eq(GYM_MACHINES.ID))
            .leftJoin(MACHINE_TEMPLATES).on(MACHINE_TEMPLATES.ID.eq(GYM_MACHINES.TEMPLATE_ID))
            .leftJoin(BRANDS).on(BRANDS.ID.eq(MACHINE_TEMPLATES.BRAND_ID))
            .where(REPORTS.STATUS.eq(STATUS_PENDING))
            .and(REPORTS.TARGET_TYPE.eq(TARGET_TYPE_GYM_MACHINE))
            .and(notInOwnerWindow())
            .groupBy(GYM_MACHINES.ID, BRANDS.NAME, MACHINE_TEMPLATES.NAME)
            .orderBy(oldestReportAt.asc())
            .limit(limit)
            .fetch(r -> new AdminQueueItem(
                TARGET_TYPE_GYM_MACHINE,
                r.get(GYM_MACHINES.ID),
                r.get(labelField),
                null,
                r.get(pendingCount),
                r.get(oldestReportAt),
                r.get(topReason)
            ));
    }

    /**
     * @deprecated Use {@link #findByTargetTypeAndIdAndStatus} so the surface
     *     filter is explicit. Photo callers pre-Task-46 used this implicit
     *     {@code target_type='photo'} form.
     */
    @Deprecated
    public List<AdminReportResponse> findByTargetIdAndStatus(UUID targetId, String status) {
        return findByTargetTypeAndIdAndStatus(TARGET_TYPE_PHOTO, targetId, status);
    }

    /**
     * ADR 0022 follow-up (Task 46): explicit target_type filter so admin screens
     * can scope to the right surface (photo detail vs gym_machine detail).
     */
    public List<AdminReportResponse> findByTargetTypeAndIdAndStatus(
            String targetType, UUID targetId, String status) {
        return dsl.select(
                REPORTS.ID, REPORTS.USER_ID, REPORTS.TARGET_TYPE, REPORTS.TARGET_ID,
                REPORTS.REASON, REPORTS.DETAIL, REPORTS.STATUS,
                REPORTS.DISPOSED_BY, REPORTS.DISPOSED_AT, REPORTS.CREATED_AT)
            .from(REPORTS)
            .where(REPORTS.TARGET_ID.eq(targetId))
            .and(REPORTS.STATUS.eq(status))
            .and(REPORTS.TARGET_TYPE.eq(targetType))
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

    /**
     * Stamp a report with the 24h owner window cutoff (Task 47 / ADR 0023 Q4 B3).
     * Called from ReportService when a newly created report targets a gym that
     * has an active owner.
     */
    public int setOwnerTimeoutAt(UUID reportId, OffsetDateTime timeout) {
        return dsl.update(REPORTS)
            .set(REPORTS.OWNER_TIMEOUT_AT, timeout)
            .where(REPORTS.ID.eq(reportId))
            .execute();
    }

    /**
     * Clear owner_timeout_at on all expired pending reports (Task 47 / ADR 0023
     * Q4 B3). Driven by {@link com.ironspot.owner.OwnerTimeoutEscalationJob}
     * every 5 minutes; setting the column to NULL surfaces those reports in
     * the admin queue.
     */
    public int clearOwnerTimeoutsBefore(OffsetDateTime cutoff) {
        return dsl.update(REPORTS)
            .setNull(REPORTS.OWNER_TIMEOUT_AT)
            .where(REPORTS.STATUS.eq(STATUS_PENDING))
            .and(REPORTS.OWNER_TIMEOUT_AT.isNotNull())
            .and(REPORTS.OWNER_TIMEOUT_AT.lessThan(cutoff))
            .execute();
    }

    /**
     * Owner disposition: like {@link #updateDisposition} but additionally clears
     * owner_timeout_at and rejects rows already past the window (Task 47 / ADR
     * 0023 Q4 B3). Returns 0 if the report has already been disposed, has had
     * its owner window expire, or never had an owner window in the first place
     * — the caller maps 0 → 403/409 at the service layer.
     */
    public int updateOwnerDisposition(UUID reportId, String disposition, UUID ownerUserId) {
        return dsl.update(REPORTS)
            .set(REPORTS.STATUS, disposition)
            .set(REPORTS.DISPOSED_BY, ownerUserId)
            .set(REPORTS.DISPOSED_AT, OffsetDateTime.now())
            .setNull(REPORTS.OWNER_TIMEOUT_AT)
            .where(REPORTS.ID.eq(reportId))
            .and(REPORTS.STATUS.eq(STATUS_PENDING))
            .and(REPORTS.OWNER_TIMEOUT_AT.isNotNull())
            .and(REPORTS.OWNER_TIMEOUT_AT.greaterThan(OffsetDateTime.now()))
            .execute();
    }

    /**
     * Owner auto-action disposition: status=actioned without queue/window check.
     * Used by self-gym auto-action paths (Task 47 / ADR 0023 Q5 W1) where the
     * reporter is the owner and the report row is fresh (no owner_timeout_at
     * set yet, because we never enter the queue).
     */
    public int updateDispositionByOwner(UUID reportId, String disposition, UUID ownerUserId) {
        return dsl.update(REPORTS)
            .set(REPORTS.STATUS, disposition)
            .set(REPORTS.DISPOSED_BY, ownerUserId)
            .set(REPORTS.DISPOSED_AT, OffsetDateTime.now())
            .where(REPORTS.ID.eq(reportId))
            .and(REPORTS.STATUS.eq(STATUS_PENDING))
            .execute();
    }

    /**
     * Owner queue: pending reports scoped to gyms the owner owns AND still
     * inside the 24h owner window (Task 47 / ADR 0023 Q4 B3). Merges photo
     * + gym_machine surfaces with per-type label/imageUrl projections.
     */
    public List<OwnerQueueItem> findOwnerQueue(UUID ownerUserId, int limit) {
        List<UUID> gymIds = dsl.select(com.ironspot.jooq.Tables.GYM_OWNERS.GYM_ID)
            .from(com.ironspot.jooq.Tables.GYM_OWNERS)
            .where(com.ironspot.jooq.Tables.GYM_OWNERS.USER_ID.eq(ownerUserId))
            .and(com.ironspot.jooq.Tables.GYM_OWNERS.REVOKED_AT.isNull())
            .fetch(r -> r.get(com.ironspot.jooq.Tables.GYM_OWNERS.GYM_ID));
        if (gymIds.isEmpty()) return List.of();

        List<OwnerQueueItem> photos = ownerQueuePhotos(gymIds, limit);
        List<OwnerQueueItem> gymMachines = ownerQueueGymMachines(gymIds, limit);
        return Stream.concat(photos.stream(), gymMachines.stream())
            .sorted(Comparator.comparing(OwnerQueueItem::createdAt))
            .limit(limit)
            .toList();
    }

    private List<OwnerQueueItem> ownerQueuePhotos(List<UUID> gymIds, int limit) {
        return dsl.select(
                REPORTS.ID, REPORTS.TARGET_ID, REPORTS.REASON, REPORTS.DETAIL,
                REPORTS.USER_ID, REPORTS.CREATED_AT, REPORTS.OWNER_TIMEOUT_AT,
                MACHINE_PHOTOS.PHOTO_URL,
                GYM_MACHINES.GYM_ID,
                GYMS.NAME)
            .from(REPORTS)
            .join(MACHINE_PHOTOS).on(MACHINE_PHOTOS.ID.eq(REPORTS.TARGET_ID))
            .join(GYM_MACHINES).on(GYM_MACHINES.ID.eq(MACHINE_PHOTOS.GYM_MACHINE_ID))
            .join(GYMS).on(GYMS.ID.eq(GYM_MACHINES.GYM_ID))
            .where(REPORTS.STATUS.eq(STATUS_PENDING))
            .and(REPORTS.TARGET_TYPE.eq(TARGET_TYPE_PHOTO))
            .and(REPORTS.OWNER_TIMEOUT_AT.isNotNull())
            .and(REPORTS.OWNER_TIMEOUT_AT.greaterThan(OffsetDateTime.now()))
            .and(GYM_MACHINES.GYM_ID.in(gymIds))
            .orderBy(REPORTS.CREATED_AT.asc())
            .limit(limit)
            .fetch(r -> new OwnerQueueItem(
                TARGET_TYPE_PHOTO,
                r.get(REPORTS.ID),
                r.get(REPORTS.TARGET_ID),
                "사진",
                r.get(MACHINE_PHOTOS.PHOTO_URL),
                r.get(REPORTS.REASON),
                r.get(REPORTS.DETAIL),
                r.get(REPORTS.USER_ID),
                r.get(REPORTS.CREATED_AT),
                r.get(REPORTS.OWNER_TIMEOUT_AT),
                r.get(GYM_MACHINES.GYM_ID),
                r.get(GYMS.NAME)
            ));
    }

    private List<OwnerQueueItem> ownerQueueGymMachines(List<UUID> gymIds, int limit) {
        Field<String> labelField = DSL.field(
            "COALESCE({0} || ' ' || {1}, '머신')",
            String.class, BRANDS.NAME, MACHINE_TEMPLATES.NAME
        ).as("label");
        return dsl.select(
                REPORTS.ID, REPORTS.TARGET_ID, REPORTS.REASON, REPORTS.DETAIL,
                REPORTS.USER_ID, REPORTS.CREATED_AT, REPORTS.OWNER_TIMEOUT_AT,
                labelField,
                GYM_MACHINES.GYM_ID,
                GYMS.NAME)
            .from(REPORTS)
            .join(GYM_MACHINES).on(GYM_MACHINES.ID.eq(REPORTS.TARGET_ID))
            .join(GYMS).on(GYMS.ID.eq(GYM_MACHINES.GYM_ID))
            .leftJoin(MACHINE_TEMPLATES).on(MACHINE_TEMPLATES.ID.eq(GYM_MACHINES.TEMPLATE_ID))
            .leftJoin(BRANDS).on(BRANDS.ID.eq(MACHINE_TEMPLATES.BRAND_ID))
            .where(REPORTS.STATUS.eq(STATUS_PENDING))
            .and(REPORTS.TARGET_TYPE.eq(TARGET_TYPE_GYM_MACHINE))
            .and(REPORTS.OWNER_TIMEOUT_AT.isNotNull())
            .and(REPORTS.OWNER_TIMEOUT_AT.greaterThan(OffsetDateTime.now()))
            .and(GYM_MACHINES.GYM_ID.in(gymIds))
            .orderBy(REPORTS.CREATED_AT.asc())
            .limit(limit)
            .fetch(r -> new OwnerQueueItem(
                TARGET_TYPE_GYM_MACHINE,
                r.get(REPORTS.ID),
                r.get(REPORTS.TARGET_ID),
                r.get(labelField),
                null,
                r.get(REPORTS.REASON),
                r.get(REPORTS.DETAIL),
                r.get(REPORTS.USER_ID),
                r.get(REPORTS.CREATED_AT),
                r.get(REPORTS.OWNER_TIMEOUT_AT),
                r.get(GYM_MACHINES.GYM_ID),
                r.get(GYMS.NAME)
            ));
    }
}
