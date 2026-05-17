package com.ironspot.owner;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.GYM_OWNERS;

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
}
