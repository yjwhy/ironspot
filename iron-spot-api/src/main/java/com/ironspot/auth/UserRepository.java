package com.ironspot.auth;

import com.ironspot.admin.dto.AdminUserSummary;
import com.ironspot.auth.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
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
        return dsl.select(USERS.ID, USERS.EMAIL, USERS.NICKNAME, USERS.CREATED_AT, USERS.ROLE)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.DELETED_AT.isNull())
            .fetchOptional(r -> {
                OffsetDateTime createdAt = r.get(USERS.CREATED_AT);
                return UserResponse.builder()
                    .id(r.get(USERS.ID).toString())
                    .email(r.get(USERS.EMAIL))
                    .nickname(r.get(USERS.NICKNAME))
                    .createdAt(createdAt != null ? createdAt.toString() : null)
                    .role(r.get(USERS.ROLE))
                    .build();
            });
    }

    public Optional<UserAuthContext> findAuthContext(String id) {
        return dsl.select(USERS.ROLE, USERS.BANNED_AT)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.DELETED_AT.isNull())
            .fetchOptional(r -> new UserAuthContext(r.get(USERS.ROLE), r.get(USERS.BANNED_AT)));
    }

    public int markBanned(String id) {
        return dsl.update(USERS)
            .set(USERS.BANNED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(id)))
            .and(USERS.BANNED_AT.isNull())
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }

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

    public int markDeleted(String userId) {
        return dsl.update(USERS)
            .set(USERS.DELETED_AT, OffsetDateTime.now())
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .and(USERS.DELETED_AT.isNull())
            .execute();
    }
}
