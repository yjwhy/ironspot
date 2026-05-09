package com.ironspot.photo;

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

import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;

@Repository
@RequiredArgsConstructor
public class PhotoRepository {

    private final DSLContext dsl;

    private PhotoResponse toPhotoResponse(Record r) {
        OffsetDateTime createdAt = r.get(MACHINE_PHOTOS.CREATED_AT);
        return new PhotoResponse(
            r.get(MACHINE_PHOTOS.ID),
            r.get(MACHINE_PHOTOS.GYM_MACHINE_ID),
            r.get(MACHINE_PHOTOS.USER_ID),
            r.get(MACHINE_PHOTOS.PHOTO_URL),
            Objects.requireNonNullElse(r.get(MACHINE_PHOTOS.UPVOTE_COUNT), 0),
            createdAt != null ? createdAt.toInstant() : null
        );
    }

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.eq(gymMachineId))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.UPVOTE_COUNT.desc(), MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponse);
    }

    public Map<UUID, List<PhotoResponse>> findByGymMachineIds(List<UUID> gymMachineIds) {
        if (gymMachineIds.isEmpty()) return Map.of();
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.GYM_MACHINE_ID.in(gymMachineIds))
            .and(MACHINE_PHOTOS.IS_BLINDED.isFalse())
            .orderBy(MACHINE_PHOTOS.UPVOTE_COUNT.desc(), MACHINE_PHOTOS.CREATED_AT.desc())
            .fetch(this::toPhotoResponse)
            .stream()
            .collect(Collectors.groupingBy(PhotoResponse::gymMachineId));
    }

    public PhotoResponse insert(UUID photoId, UUID gymMachineId, String userId, String photoUrl) {
        dsl.insertInto(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.ID, photoId)
            .set(MACHINE_PHOTOS.GYM_MACHINE_ID, gymMachineId)
            .set(MACHINE_PHOTOS.USER_ID, UUID.fromString(userId))
            .set(MACHINE_PHOTOS.PHOTO_URL, photoUrl)
            .execute();
        return new PhotoResponse(photoId, gymMachineId, UUID.fromString(userId), photoUrl, 0, null);
    }

    public Optional<PhotoResponse> findById(UUID photoId) {
        return dsl.select(
                MACHINE_PHOTOS.ID, MACHINE_PHOTOS.GYM_MACHINE_ID, MACHINE_PHOTOS.USER_ID,
                MACHINE_PHOTOS.PHOTO_URL, MACHINE_PHOTOS.UPVOTE_COUNT, MACHINE_PHOTOS.CREATED_AT)
            .from(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .fetchOptional(this::toPhotoResponse);
    }

    public void delete(UUID photoId) {
        dsl.deleteFrom(MACHINE_PHOTOS)
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .execute();
    }
}
