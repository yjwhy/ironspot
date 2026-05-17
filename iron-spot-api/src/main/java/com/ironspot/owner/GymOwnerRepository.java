package com.ironspot.owner;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.GYM_MACHINES;
import static com.ironspot.jooq.Tables.GYM_OWNERS;
import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;

/**
 * gym_owners CRUD (Task 47 / ADR 0023 Q2). Always filters revoked_at IS NULL for
 * active rows.
 */
@Repository
@RequiredArgsConstructor
public class GymOwnerRepository {

    private final DSLContext dsl;

    /**
     * Whether this user is an active owner of this gym.
     */
    public boolean isActiveOwner(UUID gymId, UUID userId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(GYM_OWNERS)
                .where(GYM_OWNERS.GYM_ID.eq(gymId))
                .and(GYM_OWNERS.USER_ID.eq(userId))
                .and(GYM_OWNERS.REVOKED_AT.isNull()));
    }

    /**
     * Returns the existing active business_number_hash for this gym, if any.
     * Use to decide co-owner auto-allow (same hash) vs dispute (different hash).
     */
    public Optional<String> existingBusinessHashForGym(UUID gymId) {
        return dsl.select(GYM_OWNERS.BUSINESS_NUMBER_HASH)
            .from(GYM_OWNERS)
            .where(GYM_OWNERS.GYM_ID.eq(gymId))
            .and(GYM_OWNERS.REVOKED_AT.isNull())
            .limit(1)
            .fetchOptional(r -> r.get(GYM_OWNERS.BUSINESS_NUMBER_HASH));
    }

    /**
     * Insert a new active owner row. Uses ON CONFLICT DO NOTHING for the
     * (gym_id, user_id) unique to make repeat verifications idempotent.
     *
     * @return true iff a row was actually inserted (false = already an owner)
     */
    public boolean insertActive(UUID gymId, UUID userId, String businessNumberHash) {
        int inserted = dsl.insertInto(GYM_OWNERS)
            .columns(GYM_OWNERS.GYM_ID, GYM_OWNERS.USER_ID, GYM_OWNERS.BUSINESS_NUMBER_HASH)
            .values(gymId, userId, businessNumberHash)
            .onConflictDoNothing()
            .execute();
        return inserted > 0;
    }

    /**
     * All gym_ids this user is an active owner of (Task 47 / ADR 0023 Q4 B3).
     * Drives the owner queue scoping — owners only see reports for these gyms.
     */
    public List<UUID> findActiveGymIdsForOwner(UUID userId) {
        return dsl.select(GYM_OWNERS.GYM_ID)
            .from(GYM_OWNERS)
            .where(GYM_OWNERS.USER_ID.eq(userId))
            .and(GYM_OWNERS.REVOKED_AT.isNull())
            .fetch(r -> r.get(GYM_OWNERS.GYM_ID));
    }

    /**
     * If the photo's gym has at least one active owner, return that gym_id.
     * Used by ReportService to decide whether to set owner_timeout_at on a
     * newly created photo report (Task 47 / ADR 0023 Q4 B3).
     */
    public Optional<UUID> findActiveOwnerGymForPhoto(UUID photoId) {
        return dsl.select(GYM_MACHINES.GYM_ID)
            .from(MACHINE_PHOTOS)
            .join(GYM_MACHINES).on(GYM_MACHINES.ID.eq(MACHINE_PHOTOS.GYM_MACHINE_ID))
            .join(GYM_OWNERS).on(GYM_OWNERS.GYM_ID.eq(GYM_MACHINES.GYM_ID))
            .where(MACHINE_PHOTOS.ID.eq(photoId))
            .and(GYM_OWNERS.REVOKED_AT.isNull())
            .limit(1)
            .fetchOptional(r -> r.get(GYM_MACHINES.GYM_ID));
    }

    /**
     * Same as {@link #findActiveOwnerGymForPhoto(UUID)} but for a gym_machine
     * target directly (Task 47 / ADR 0023 Q4 B3).
     */
    public Optional<UUID> findActiveOwnerGymForGymMachine(UUID gymMachineId) {
        return dsl.select(GYM_MACHINES.GYM_ID)
            .from(GYM_MACHINES)
            .join(GYM_OWNERS).on(GYM_OWNERS.GYM_ID.eq(GYM_MACHINES.GYM_ID))
            .where(GYM_MACHINES.ID.eq(gymMachineId))
            .and(GYM_OWNERS.REVOKED_AT.isNull())
            .limit(1)
            .fetchOptional(r -> r.get(GYM_MACHINES.GYM_ID));
    }

    /**
     * Reporter-owner check for photo self-gym auto-action (Task 47 / ADR 0023 Q5 W1).
     * Returns true iff the user is an active owner of the gym this photo belongs to.
     */
    public boolean isActiveOwnerOfPhotoGym(UUID userId, UUID photoId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(MACHINE_PHOTOS)
                .join(GYM_MACHINES).on(GYM_MACHINES.ID.eq(MACHINE_PHOTOS.GYM_MACHINE_ID))
                .join(GYM_OWNERS).on(GYM_OWNERS.GYM_ID.eq(GYM_MACHINES.GYM_ID))
                .where(MACHINE_PHOTOS.ID.eq(photoId))
                .and(GYM_OWNERS.USER_ID.eq(userId))
                .and(GYM_OWNERS.REVOKED_AT.isNull()));
    }

    /**
     * Reporter-owner check for gym_machine self-gym auto-action (Task 47 /
     * ADR 0023 Q5 W1). Returns true iff the user is an active owner of the
     * gym this gym_machine belongs to.
     */
    public boolean isActiveOwnerOfGymMachineGym(UUID userId, UUID gymMachineId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(GYM_MACHINES)
                .join(GYM_OWNERS).on(GYM_OWNERS.GYM_ID.eq(GYM_MACHINES.GYM_ID))
                .where(GYM_MACHINES.ID.eq(gymMachineId))
                .and(GYM_OWNERS.USER_ID.eq(userId))
                .and(GYM_OWNERS.REVOKED_AT.isNull()));
    }
}
