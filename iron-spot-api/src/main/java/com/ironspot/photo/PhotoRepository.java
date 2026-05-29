package com.ironspot.photo;

import com.ironspot.admin.dto.AdminPhotoSummary;
import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.ironspot.jooq.Tables.GYMS;
import static com.ironspot.jooq.Tables.GYM_MACHINES;
import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.MACHINE_TEMPLATES;

@Repository
@RequiredArgsConstructor
public class PhotoRepository {

    private final DSLContext dsl;

    // Photo rows without the gym-context join (gymId/gymName/machineName left
    // null). Used by surfaces that already know the gym context (gym detail
    // batch) or don't need it (upvote/report echo).
    private PhotoResponse toPhotoResponse(Record r) {
        OffsetDateTime createdAt = r.get(MACHINE_PHOTOS.CREATED_AT);
        OffsetDateTime verifiedByOwnerAt = r.get(MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT);
        UUID id = r.get(MACHINE_PHOTOS.ID);
        return new PhotoResponse(
            id,
            r.get(MACHINE_PHOTOS.GYM_MACHINE_ID),
            r.get(MACHINE_PHOTOS.USER_ID),
            r.get(MACHINE_PHOTOS.PHOTO_URL),
            PhotoProxyPath.forPhoto(id),
            Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.UPVOTE_COUNT), 0),
            createdAt != null ? createdAt.toInstant() : null,
            verifiedByOwnerAt != null ? verifiedByOwnerAt.toInstant() : null,
            null,
            null,
            null
        );
    }

    // Photo rows with the gym + machine context resolved via LEFT JOINs.
    // machineName prefers the catalog template's Korean name and falls back to
    // the gym's custom (free-form) name; all three context fields stay null
    // for orphan photos (gym_machine_id IS NULL), since the joins drop out.
    private PhotoResponse toPhotoResponseWithGym(Record r) {
        OffsetDateTime createdAt = r.get(MACHINE_PHOTOS.CREATED_AT);
        OffsetDateTime verifiedByOwnerAt = r.get(MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT);
        UUID id = r.get(MACHINE_PHOTOS.ID);
        // Null-safe coalesce: stays null for orphan photos where both columns
        // are absent (requireNonNullElse would NPE on two nulls).
        String templateName = r.get(MACHINE_TEMPLATES.NAME_KO);
        String machineName = templateName != null ? templateName : r.get(GYM_MACHINES.CUSTOM_NAME);
        return new PhotoResponse(
            id,
            r.get(MACHINE_PHOTOS.GYM_MACHINE_ID),
            r.get(MACHINE_PHOTOS.USER_ID),
            r.get(MACHINE_PHOTOS.PHOTO_URL),
            PhotoProxyPath.forPhoto(id),
            Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.UPVOTE_COUNT), 0),
            createdAt != null ? createdAt.toInstant() : null,
            verifiedByOwnerAt != null ? verifiedByOwnerAt.toInstant() : null,
            r.get(GYM_MACHINES.GYM_ID),
            r.get(GYMS.NAME),
            machineName
        );
    }

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT,
                GYM_MACHINES.GYM_ID, GYMS.NAME, MACHINE_TEMPLATES.NAME_KO, GYM_MACHINES.CUSTOM_NAME)
            .from(MACHINE_PHOTOS)
            .leftJoin(GYM_MACHINES).on(GYM_MACHINES.ID.eq(MACHINE_PHOTOS.GYM_MACHINE_ID))
            .leftJoin(GYMS).on(GYMS.ID.eq(GYM_MACHINES.GYM_ID))
            .leftJoin(MACHINE_TEMPLATES).on(MACHINE_TEMPLATES.ID.eq(GYM_MACHINES.TEMPLATE_ID))
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.eq(gymMachineId))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.UPVOTE_COUNT.desc(), MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponseWithGym);
    }

    public List<PhotoResponse> findByUserId(UUID userId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT,
                GYM_MACHINES.GYM_ID, GYMS.NAME, MACHINE_TEMPLATES.NAME_KO, GYM_MACHINES.CUSTOM_NAME)
            .from(MACHINE_PHOTOS)
            .leftJoin(GYM_MACHINES).on(GYM_MACHINES.ID.eq(MACHINE_PHOTOS.GYM_MACHINE_ID))
            .leftJoin(GYMS).on(GYMS.ID.eq(GYM_MACHINES.GYM_ID))
            .leftJoin(MACHINE_TEMPLATES).on(MACHINE_TEMPLATES.ID.eq(GYM_MACHINES.TEMPLATE_ID))
            .where(MACHINE_PHOTOS.USER_ID.eq(userId))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponseWithGym);
    }

    public Map<UUID, List<PhotoResponse>> findByGymMachineIds(List<UUID> gymMachineIds) {
        if (gymMachineIds.isEmpty()) return Map.of();
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.in(gymMachineIds))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.UPVOTE_COUNT.desc(), MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponse)
            .stream()
            .collect(Collectors.groupingBy(PhotoResponse::gymMachineId));
    }

    public void insert(
        UUID photoId,
        UUID gymMachineId,
        String userId,
        String photoUrl,
        String storagePath,
        boolean isBlinded
    ) {
        // Security A3: storagePath is the bucket-relative key. Phase 1
        // writes both photo_url (long-TTL URL, backward compat) and
        // storage_path (path-only, fuel for the future short-TTL proxy
        // endpoint). Phase 2 will drop photo_url from the response DTO.
        dsl.insertInto(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.ID, photoId)
            .set(MACHINE_PHOTOS.GYM_MACHINE_ID, gymMachineId)
            .set(MACHINE_PHOTOS.USER_ID, UUID.fromString(userId))
            .set(MACHINE_PHOTOS.PHOTO_URL, photoUrl)
            .set(MACHINE_PHOTOS.STORAGE_PATH, storagePath)
            .set(MACHINE_PHOTOS.IS_BLINDED, isBlinded)
            .execute();
    }

    /**
     * Security task #25: lookup the {@code is_blinded} flag without pulling the
     * rest of the photo row. {@code Optional.empty()} means the photoId does
     * not exist in the table; a present {@code Boolean} carries the blind state.
     * Used by {@link ReportService} to fail-fast on hand-crafted UUIDs before
     * an INSERT FK violation reaches the Sentry breadcrumb pipeline.
     */
    public Optional<Boolean> findIsBlinded(UUID photoId) {
        return dsl.select(MACHINE_PHOTOS.IS_BLINDED)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(r -> Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.IS_BLINDED), false));
    }

    /**
     * Security A3: drive the photo proxy endpoint. Returns the
     * bucket-relative path + the blinded flag in one round-trip so the
     * controller can decide 302 vs 410 (blinded) without two queries.
     */
    public record PhotoStorageRef(String storagePath, boolean isBlinded) {}

    public Optional<PhotoStorageRef> findStorageRef(UUID photoId) {
        return dsl.select(MACHINE_PHOTOS.STORAGE_PATH, MACHINE_PHOTOS.IS_BLINDED)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(r -> new PhotoStorageRef(
                r.get(MACHINE_PHOTOS.STORAGE_PATH),
                Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.IS_BLINDED), false)));
    }

    public Optional<PhotoResponse> findById(UUID photoId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(this::toPhotoResponse);
    }

    public void delete(UUID photoId) {
        dsl.deleteFrom(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .execute();
    }

    public Optional<AdminPhotoSummary> findForAdmin(UUID photoId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT,
                MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.IS_BLINDED)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(r -> new AdminPhotoSummary(
                r.get(MACHINE_PHOTOS.ID),
                r.get(MACHINE_PHOTOS.GYM_MACHINE_ID),
                r.get(MACHINE_PHOTOS.USER_ID),
                r.get(MACHINE_PHOTOS.PHOTO_URL),
                PhotoProxyPath.forPhoto(r.get(MACHINE_PHOTOS.ID)),
                Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.UPVOTE_COUNT), 0),
                r.get(MACHINE_PHOTOS.CREATED_AT),
                Boolean.TRUE.equals(r.get(MACHINE_PHOTOS.IS_BLINDED))
            ));
    }

    public Optional<UUID> findUploader(UUID photoId) {
        return dsl.select(MACHINE_PHOTOS.USER_ID)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(r -> r.get(MACHINE_PHOTOS.USER_ID));
    }

    public boolean isOwner(UUID photoId, UUID userId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(MACHINE_PHOTOS)
                .where(MACHINE_PHOTOS.ID.eq(photoId))
                .and(MACHINE_PHOTOS.USER_ID.eq(userId))
        );
    }

    public void setBlinded(UUID photoId, boolean blinded) {
        dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.IS_BLINDED, blinded)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .execute();
    }

    /**
     * Conditional blind: only flips FALSE → TRUE. Returns true if this call
     * actually changed the row, false if the photo was already blinded.
     * Used to prevent duplicate Slack alerts when concurrent reports cross
     * the auto-blind threshold simultaneously.
     */
    public boolean blindIfNotAlreadyBlinded(UUID photoId) {
        int rows = dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.IS_BLINDED, true)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .and(MACHINE_PHOTOS.IS_BLINDED.eq(false))
            .execute();
        return rows > 0;
    }

    /**
     * Mark a photo as verified by an owner (Task 47 / ADR 0023 Q5 T1/T2).
     * Idempotent: only flips NULL → NOW(). Returns rows affected so the
     * service can detect "already verified" duplicates without a re-read.
     */
    public int markVerifiedByOwner(UUID photoId) {
        return dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT, OffsetDateTime.now())
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .and(MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT.isNull())
            .execute();
    }

    /**
     * Lookup the gym_id for a photo via its gym_machine (Task 47 /
     * ADR 0023 Q5 P3). Used by service-layer ownership checks.
     */
    public Optional<UUID> findGymIdByPhotoId(UUID photoId) {
        return dsl.select(GYM_MACHINES.GYM_ID)
            .from(MACHINE_PHOTOS)
            .join(GYM_MACHINES).on(GYM_MACHINES.ID.eq(MACHINE_PHOTOS.GYM_MACHINE_ID))
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(r -> r.get(GYM_MACHINES.GYM_ID));
    }

    /**
     * Lookup the gym_machine_id for a photo (Task 47 / ADR 0023 Q5 P3).
     */
    public Optional<UUID> findGymMachineIdByPhotoId(UUID photoId) {
        return dsl.select(MACHINE_PHOTOS.GYM_MACHINE_ID)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(r -> r.get(MACHINE_PHOTOS.GYM_MACHINE_ID));
    }

    /**
     * Phase 5 item 11 slice 1: bind an orphan photo (uploaded with NULL
     * gym_machine_id) to the new contribution row inside the same request.
     *
     * The {@code IS NULL} guard is load-bearing: it prevents a caller who
     * owns an already-bound photo from silently relocating it to a brand-new
     * contribution row, which would vandalise prior contributions and break
     * vote / report integrity. Slice 2 changes PhotoService.upload to write
     * NULL initially so this guard is reachable from the live flow.
     *
     * Returns rows affected — 0 means either the photo doesn't exist or it
     * was already bound to another row; the service reads that as 400.
     */
    public int bindOrphanGymMachineId(UUID photoId, UUID newGymMachineId) {
        return dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.GYM_MACHINE_ID, newGymMachineId)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .and(MACHINE_PHOTOS.GYM_MACHINE_ID.isNull())
            .execute();
    }

    /**
     * Phase 5 item 11 sub-task 4: re-bind every machine_photos row from a
     * source gym_machine to a target gym_machine. Used in the merge branch
     * of admin promote so the rejected pending row's photos follow it into
     * the existing approved row. Returns rows affected for assertion in tests.
     */
    public int rebindGymMachineId(UUID fromGymMachineId, UUID toGymMachineId) {
        return dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.GYM_MACHINE_ID, toGymMachineId)
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.eq(fromGymMachineId))
            .execute();
    }

    /**
     * Phase 5 item 11 slice (a): count orphan photos owned by a user that
     * were uploaded after the given cutoff. Backs the per-user quota
     * precheck in {@code PhotoService.upload} (slice b) so a single user
     * can't fill {@code <bucket>/orphan/<userId>/} with images without ever
     * binding them to a contribution row.
     *
     * <p>The V10 partial index
     * {@code idx_machine_photos_orphan_user_created} covers exactly this
     * predicate set (user_id, created_at, WHERE gym_machine_id IS NULL) so
     * the COUNT runs as an index-only scan over the small orphan partition
     * even as machine_photos grows.
     */
    public int countOrphansForUserSince(UUID userId, OffsetDateTime since) {
        return dsl.fetchCount(
            dsl.selectOne()
                .from(MACHINE_PHOTOS)
                .where(MACHINE_PHOTOS.USER_ID.eq(userId))
                .and(MACHINE_PHOTOS.GYM_MACHINE_ID.isNull())
                .and(MACHINE_PHOTOS.CREATED_AT.greaterOrEqual(since)));
    }

    /**
     * Phase 5 cost safety net (Layer B): every {@code machine_photos} row
     * corresponds to a Vision API call attempt (cache hits don't insert
     * fresh rows in this table — they reuse the cached Vision verdict but
     * still create a photo row, so each upload counts toward the user's
     * quota regardless of whether the Vision call cost a credit).
     *
     * <p>The V12 non-partial index {@code idx_machine_photos_user_created}
     * covers {@code (user_id, created_at)} so this COUNT runs as an
     * index-only scan even on the bound-upload path (where the V10 partial
     * index doesn't apply).
     *
     * <p>{@code is_blinded} filter excluded because a photo is still a
     * Vision-spending upload even if later moderated. Quota counts what
     * the user CONSUMED, not what survives moderation.
     */
    public int countVisionCallsForUserSince(UUID userId, OffsetDateTime since) {
        return dsl.fetchCount(
            dsl.selectOne()
                .from(MACHINE_PHOTOS)
                .where(MACHINE_PHOTOS.USER_ID.eq(userId))
                .and(MACHINE_PHOTOS.CREATED_AT.greaterOrEqual(since)));
    }

    /**
     * Phase 5 item 11 slice (c): identity + URL of every orphan photo
     * uploaded before the given cutoff. The reaper job pages through this
     * list to compute the Storage path for each, then deletes the row +
     * file. Reads the same partial index as the quota COUNT (V10).
     */
    public record OrphanRow(UUID id, String photoUrl) {}

    public List<OrphanRow> findOrphansOlderThan(OffsetDateTime cutoff) {
        return dsl.select(MACHINE_PHOTOS.ID, MACHINE_PHOTOS.PHOTO_URL)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.isNull())
            .and(MACHINE_PHOTOS.CREATED_AT.lessThan(cutoff))
            .fetch(r -> new OrphanRow(
                r.get(MACHINE_PHOTOS.ID),
                r.get(MACHINE_PHOTOS.PHOTO_URL)));
    }

    /**
     * Phase 5 item 11 slice (c): conditionally delete an orphan row only if
     * it is still orphan at DELETE time. The {@code gym_machine_id IS NULL}
     * predicate makes the call race-safe against a concurrent
     * {@link #bindOrphanGymMachineId} that fires between the reaper's
     * SELECT and DELETE — in that case the DELETE returns 0 and the caller
     * skips the Storage file delete so the now-bound photo's image survives.
     */
    public int deleteOrphanIfStillOrphan(UUID photoId) {
        return dsl.deleteFrom(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .and(MACHINE_PHOTOS.GYM_MACHINE_ID.isNull())
            .execute();
    }
}
