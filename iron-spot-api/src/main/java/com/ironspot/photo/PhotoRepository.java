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

import static com.ironspot.jooq.Tables.GYM_MACHINES;
import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;

@Repository
@RequiredArgsConstructor
public class PhotoRepository {

    private final DSLContext dsl;

    private PhotoResponse toPhotoResponse(Record r) {
        OffsetDateTime createdAt = r.get(MACHINE_PHOTOS.CREATED_AT);
        OffsetDateTime verifiedByOwnerAt = r.get(MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT);
        return new PhotoResponse(
            r.get(MACHINE_PHOTOS.ID),
            r.get(MACHINE_PHOTOS.GYM_MACHINE_ID),
            r.get(MACHINE_PHOTOS.USER_ID),
            r.get(MACHINE_PHOTOS.PHOTO_URL),
            Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.UPVOTE_COUNT), 0),
            createdAt != null ? createdAt.toInstant() : null,
            verifiedByOwnerAt != null ? verifiedByOwnerAt.toInstant() : null
        );
    }

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.eq(gymMachineId))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.UPVOTE_COUNT.desc(), MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponse);
    }

    public List<PhotoResponse> findByUserId(UUID userId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT, MACHINE_PHOTOS.VERIFIED_BY_OWNER_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.USER_ID.eq(userId))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponse);
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

    public void insert(UUID photoId, UUID gymMachineId, String userId, String photoUrl, boolean isBlinded) {
        dsl.insertInto(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.ID, photoId)
            .set(MACHINE_PHOTOS.GYM_MACHINE_ID, gymMachineId)
            .set(MACHINE_PHOTOS.USER_ID, UUID.fromString(userId))
            .set(MACHINE_PHOTOS.PHOTO_URL, photoUrl)
            .set(MACHINE_PHOTOS.IS_BLINDED, isBlinded)
            .execute();
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
