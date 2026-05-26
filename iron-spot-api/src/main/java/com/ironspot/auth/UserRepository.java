package com.ironspot.auth;

import com.ironspot.admin.dto.AdminUserSummary;
import com.ironspot.auth.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.PHOTO_VOTES;
import static com.ironspot.jooq.Tables.USERS;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final DSLContext dsl;

    public Optional<UserResponse> findById(String id) {
        return dsl.select(
                USERS.ID, USERS.EMAIL, USERS.NICKNAME, USERS.CREATED_AT, USERS.ROLE,
                USERS.CONSENT_ACCEPTED_AT, USERS.CONSENT_VERSION)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.DELETED_AT.isNull())
            .fetchOptional(r -> {
                OffsetDateTime createdAt = r.get(USERS.CREATED_AT);
                OffsetDateTime consentAt = r.get(USERS.CONSENT_ACCEPTED_AT);
                return UserResponse.builder()
                    .id(r.get(USERS.ID).toString())
                    .email(r.get(USERS.EMAIL))
                    .nickname(r.get(USERS.NICKNAME))
                    .createdAt(createdAt != null ? createdAt.toString() : null)
                    .role(r.get(USERS.ROLE))
                    .consentAcceptedAt(consentAt != null ? consentAt.toString() : null)
                    .consentVersion(r.get(USERS.CONSENT_VERSION))
                    .build();
            });
    }

    /**
     * Security A4: same projection as {@link #findById} but also matches
     * rows in the grace window (deleted_at set, deletion_finalized_at
     * NULL). Used by {@code UserService.getOrCreate} so a user who hits
     * /api/users/me during their grace window sees their own row + the
     * "deletion pending" flag instead of silently re-creating an
     * active account on top of their pending-deletion row.
     *
     * <p>Excludes terminally finalised rows (both timestamps set) — the
     * row is effectively a tombstone at that point and the caller should
     * insert a fresh user record if needed.
     */
    public Optional<UserResponse> findByIdAllowingGrace(String id) {
        return dsl.select(
                USERS.ID, USERS.EMAIL, USERS.NICKNAME, USERS.CREATED_AT, USERS.ROLE,
                USERS.CONSENT_ACCEPTED_AT, USERS.CONSENT_VERSION,
                USERS.DELETED_AT, USERS.DELETION_FINALIZED_AT)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.DELETION_FINALIZED_AT.isNull())
            .fetchOptional(r -> {
                OffsetDateTime createdAt = r.get(USERS.CREATED_AT);
                OffsetDateTime consentAt = r.get(USERS.CONSENT_ACCEPTED_AT);
                OffsetDateTime deletedAt = r.get(USERS.DELETED_AT);
                return UserResponse.builder()
                    .id(r.get(USERS.ID).toString())
                    .email(r.get(USERS.EMAIL))
                    .nickname(r.get(USERS.NICKNAME))
                    .createdAt(createdAt != null ? createdAt.toString() : null)
                    .role(r.get(USERS.ROLE))
                    .consentAcceptedAt(consentAt != null ? consentAt.toString() : null)
                    .consentVersion(r.get(USERS.CONSENT_VERSION))
                    .deletionRequestedAt(deletedAt != null ? deletedAt.toString() : null)
                    .build();
            });
    }

    /**
     * Security A4: clear deleted_at when the user cancels their pending
     * deletion within the grace window. Idempotent on already-active
     * rows (returns 0). Refuses to revive a row that has already been
     * finalised — the WHERE clause filters deletion_finalized_at IS NULL.
     */
    @CacheEvict(value = "authContext", key = "#userId")
    public int cancelDeletion(String userId) {
        return dsl.update(USERS)
            .setNull(USERS.DELETED_AT)
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .and(USERS.DELETED_AT.isNotNull())
            .and(USERS.DELETION_FINALIZED_AT.isNull())
            .execute();
    }

    /**
     * Security A4: row IDs whose grace window has expired and whose
     * content still needs to be anonymised. The daily finaliser job
     * uses this; the partial index
     * {@code idx_users_pending_deletion} keeps the scan cheap.
     */
    public java.util.List<String> findExpiredGraceUserIds(OffsetDateTime cutoff) {
        return dsl.select(USERS.ID)
            .from(USERS)
            .where(USERS.DELETED_AT.isNotNull())
            .and(USERS.DELETED_AT.lt(cutoff))
            .and(USERS.DELETION_FINALIZED_AT.isNull())
            .fetch(r -> r.get(USERS.ID).toString());
    }

    /**
     * Security A4: stamp the finalised marker after the content has
     * been anonymised. Re-running on an already-finalised row is a
     * no-op (WHERE filters deletion_finalized_at IS NULL).
     */
    @CacheEvict(value = "authContext", key = "#userId")
    public int markDeletionFinalized(String userId) {
        return dsl.update(USERS)
            .set(USERS.DELETION_FINALIZED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .and(USERS.DELETED_AT.isNotNull())
            .and(USERS.DELETION_FINALIZED_AT.isNull())
            .execute();
    }

    /**
     * Security task #17 — write the PIPA consent timestamp + the policy
     * version the user actively agreed to. Returns the row count so the
     * service can detect "user not found" without a second SELECT.
     */
    public int recordConsent(String userId, String version) {
        return dsl.update(USERS)
            .set(USERS.CONSENT_ACCEPTED_AT, OffsetDateTime.now())
            .set(USERS.CONSENT_VERSION, version)
            .set(USERS.UPDATED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }

    /**
     * Security task #24: read-through cache for the per-request auth context
     * lookup. Without this, every authenticated request burnt one DB round
     * trip in {@link JwtAuthenticationFilter}; a Caffeine-backed
     * @Cacheable with a 60s TTL collapses repeats to one DB hit per user
     * per minute while keeping bans propagated within a minute (with explicit
     * eviction on {@link #markBanned}/{@link #markUnbanned}/{@link #markDeleted}
     * making bans effective immediately for that user).
     */
    @Cacheable("authContext")
    public Optional<UserAuthContext> findAuthContext(String id) {
        return dsl.select(USERS.ROLE, USERS.BANNED_AT)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.DELETED_AT.isNull())
            .fetchOptional(r -> new UserAuthContext(r.get(USERS.ROLE), r.get(USERS.BANNED_AT)));
    }

    @CacheEvict(value = "authContext", key = "#id")
    public int markBanned(String id) {
        return dsl.update(USERS)
            .set(USERS.BANNED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.BANNED_AT.isNull())
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }

    @CacheEvict(value = "authContext", key = "#id")
    public int markUnbanned(String id) {
        return dsl.update(USERS)
            .setNull(USERS.BANNED_AT)
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.BANNED_AT.isNotNull())
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }

    public Optional<AdminUserSummary> findSummary(UUID id) {
        return dsl.select(USERS.ID, USERS.NICKNAME, USERS.BANNED_AT)
            .from(USERS)
            .where(USERS.ID.eq(id))
            .and(USERS.DELETED_AT.isNull())
            .fetchOptional(r -> new AdminUserSummary(
                r.get(USERS.ID),
                r.get(USERS.NICKNAME),
                r.get(USERS.BANNED_AT)
            ));
    }

    public void insert(String id, String email, String nickname) {
        dsl.insertInto(USERS, USERS.ID, USERS.EMAIL, USERS.NICKNAME)
            .values(UUID.fromString(id), email, nickname)
            .onConflictDoNothing()
            .execute();
    }

    public int updateNickname(String userId, String nickname) {
        return dsl.update(USERS)
            .set(USERS.NICKNAME, nickname)
            .set(USERS.UPDATED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }

    public void anonymizePhotos(String userId) {
        dsl.update(MACHINE_PHOTOS)
            .setNull(MACHINE_PHOTOS.USER_ID)
            .where(MACHINE_PHOTOS.USER_ID.eq(UUID.fromString(userId)))
            .execute();
    }

    public void deleteVotes(String userId) {
        dsl.deleteFrom(PHOTO_VOTES)
            .where(PHOTO_VOTES.USER_ID.eq(UUID.fromString(userId)))
            .execute();
    }

    @CacheEvict(value = "authContext", key = "#userId")
    public int markDeleted(String userId) {
        return dsl.update(USERS)
            .set(USERS.DELETED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }

    /**
     * Promote a 'user' to 'owner'. Admins are left untouched (they keep
     * elevated privileges; owner is not a higher tier than admin). Idempotent:
     * already-owner rows match the WHERE filter on role='user' and return 0.
     */
    @CacheEvict(value = "authContext", key = "#userId.toString()")
    public int promoteToOwner(UUID userId) {
        return dsl.update(USERS)
            .set(USERS.ROLE, "owner")
            .set(USERS.UPDATED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(userId))
            .and(USERS.ROLE.eq("user"))
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }
}
