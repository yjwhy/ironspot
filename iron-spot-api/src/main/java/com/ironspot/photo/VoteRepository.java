package com.ironspot.photo;

import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.PHOTO_VOTES;
import static org.jooq.impl.DSL.greatest;
import static org.jooq.impl.DSL.val;

@Repository
@RequiredArgsConstructor
public class VoteRepository {

    private final DSLContext dsl;

    public boolean insertVote(UUID userId, UUID photoId) {
        int rows = dsl.insertInto(PHOTO_VOTES)
            .set(PHOTO_VOTES.USER_ID, userId)
            .set(PHOTO_VOTES.PHOTO_ID, photoId)
            .onConflictDoNothing()
            .execute();
        return rows > 0;
    }

    public boolean deleteVote(UUID userId, UUID photoId) {
        int rows = dsl.deleteFrom(PHOTO_VOTES)
            .where(PHOTO_VOTES.USER_ID.eq(userId))
            .and(PHOTO_VOTES.PHOTO_ID.eq(photoId))
            .execute();
        return rows > 0;
    }

    public void incrementCount(UUID photoId) {
        dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.UPVOTE_COUNT.add(1))
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .execute();
    }

    public void decrementCount(UUID photoId) {
        dsl.update(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.UPVOTE_COUNT, greatest(val(0), MACHINE_PHOTOS.UPVOTE_COUNT.sub(1)))
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .execute();
    }

    public List<PhotoResponse> findUpvotedByUser(UUID userId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT)
            .from(PHOTO_VOTES)
            .join(MACHINE_PHOTOS).on(MACHINE_PHOTOS.ID.eq(PHOTO_VOTES.PHOTO_ID))
            .where(PHOTO_VOTES.USER_ID.eq(userId))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(PHOTO_VOTES.CREATED_AT.desc())
            .fetch(r -> {
                OffsetDateTime createdAt = r.get(MACHINE_PHOTOS.CREATED_AT);
                return new PhotoResponse(
                    r.get(MACHINE_PHOTOS.ID),
                    r.get(MACHINE_PHOTOS.GYM_MACHINE_ID),
                    r.get(MACHINE_PHOTOS.USER_ID),
                    r.get(MACHINE_PHOTOS.PHOTO_URL),
                    Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.UPVOTE_COUNT), 0),
                    createdAt != null ? createdAt.toInstant() : null
                );
            });
    }

    public int getCount(UUID photoId) {
        Integer count = dsl.select(MACHINE_PHOTOS.UPVOTE_COUNT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOneInto(Integer.class);
        return Objects.requireNonNullElse(count, 0);
    }
}
