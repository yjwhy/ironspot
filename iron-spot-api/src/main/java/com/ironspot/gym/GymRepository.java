package com.ironspot.gym;

import com.ironspot.gym.dto.CreateGymRequest;
import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.search.dsl.SearchScope;
import com.ironspot.jooq.tables.Brands;
import com.ironspot.jooq.tables.GymMachines;
import com.ironspot.jooq.tables.Gyms;
import com.ironspot.jooq.tables.MachineTemplates;
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

import static com.ironspot.jooq.Tables.*;

@Repository
@RequiredArgsConstructor
public class GymRepository {

    private final DSLContext dsl;

    /**
     * Max distinct machine names returned in {@link GymWithMachineCountResponse#matchedMachineNames}.
     * Kept &gt; GymCard.MATCHED_MACHINES_INLINE_LIMIT (frontend, currently 3) so the
     * "외 +N" overflow indicator in the card has at least 2 hidden items to count.
     * Reducing this below 3 will hide content the UI expects to present.
     */
    private static final int MATCHED_MACHINES_LIMIT = 5;

    public List<GymWithMachineCountResponse> searchInBounds(GymSearchRequest req) {
        Gyms g = GYMS.as("g");
        GymMachines gm = GYM_MACHINES.as("gm");
        MachineTemplates mt = MACHINE_TEMPLATES.as("mt");
        Brands b = BRANDS.as("b");

        Field<Double> lat = DSL.field("ST_Y(g.location::geometry)", Double.class);
        Field<Double> lng = DSL.field("ST_X(g.location::geometry)", Double.class);
        Field<Integer> machineCount = DSL.countDistinct(gm.ID).as("machine_count");
        // PostgreSQL array_agg(DISTINCT ...) — top N trim happens in Java since
        // PG doesn't allow LIMIT inside aggregate. Typical gym has <30 templates
        // so unbounded aggregation is fine in practice.
        Field<String[]> matchedNamesField = DSL.field(
            "array_agg(DISTINCT {0} || ' ' || {1})",
            String[].class,
            b.NAME, mt.NAME
        ).as("matched_names");

        Condition spatialCond = DSL.condition(
            "ST_Within(g.location::geometry, ST_MakeEnvelope({0}, {1}, {2}, {3}, 4326))",
            DSL.val(req.getMinLng()), DSL.val(req.getMinLat()),
            DSL.val(req.getMaxLng()), DSL.val(req.getMaxLat())
        );

        Condition brandCond = req.getBrandIds() != null && !req.getBrandIds().isEmpty()
            ? mt.BRAND_ID.in(req.getBrandIds().stream().map(UUID::fromString).toList())
            : DSL.noCondition();

        Condition categoryCond = req.getCategoryIds() != null && !req.getCategoryIds().isEmpty()
            ? mt.CATEGORY_ID.in(req.getCategoryIds().stream().map(UUID::fromString).toList())
            : DSL.noCondition();

        // ADR 0022 — templateIds OR/AND filtering.
        // OR (EACH, default): mt.ID.in(uuids) restricts the join; gym returns
        //   if at least one machine matches.
        // AND (COMBINED): WHERE stays permissive on templates; HAVING enforces
        //   the gym has all N requested templates via COUNT DISTINCT over a
        //   CASE expression. Brand/category WHERE filters still apply to the
        //   join (so matching templates must also satisfy brand/category if set).
        List<UUID> templateUuids = req.getTemplateIds() != null && !req.getTemplateIds().isEmpty()
            ? req.getTemplateIds().stream().map(UUID::fromString).toList()
            : List.of();
        boolean templateAnd = !templateUuids.isEmpty() && req.getScope() == SearchScope.COMBINED;

        Condition templateWhereCond = !templateUuids.isEmpty() && !templateAnd
            ? mt.ID.in(templateUuids)
            : DSL.noCondition();

        Condition templateHavingCond = templateAnd
            ? DSL.countDistinct(DSL.when(mt.ID.in(templateUuids), mt.ID).otherwise((UUID) null))
                .eq(templateUuids.size())
            : DSL.noCondition();

        return dsl.select(
                g.ID, g.NAME, g.ADDRESS, lat, lng,
                g.PHONE, g.OPERATING_HOURS, g.DAY_PASS_PRICE,
                g.IS_VERIFIED, g.LAST_VERIFIED_AT, g.CREATED_AT, g.UPDATED_AT,
                machineCount, matchedNamesField)
            .from(g)
            .leftJoin(gm).on(gm.GYM_ID.eq(g.ID))
            .leftJoin(mt).on(mt.ID.eq(gm.TEMPLATE_ID))
            .leftJoin(b).on(b.ID.eq(mt.BRAND_ID))
            .where(spatialCond)
            .and(brandCond)
            .and(categoryCond)
            .and(templateWhereCond)
            .groupBy(g.ID, g.NAME, g.ADDRESS, g.PHONE, g.OPERATING_HOURS,
                g.DAY_PASS_PRICE, g.IS_VERIFIED, g.LAST_VERIFIED_AT,
                g.CREATED_AT, g.UPDATED_AT)
            .having(templateHavingCond)
            .orderBy(machineCount.desc())
            .fetch(r -> {
                OffsetDateTime lastVerified = r.get(g.LAST_VERIFIED_AT);
                String[] rawNames = r.get(matchedNamesField);
                List<String> matched = rawNames == null
                    ? List.of()
                    : Stream.of(rawNames)
                        .filter(Objects::nonNull)
                        .sorted(Comparator.naturalOrder())
                        .limit(MATCHED_MACHINES_LIMIT)
                        .toList();
                return new GymWithMachineCountResponse(
                    r.get(g.ID),
                    r.get(g.NAME),
                    r.get(g.ADDRESS),
                    Objects.requireNonNullElse(r.get(lat), 0.0),
                    Objects.requireNonNullElse(r.get(lng), 0.0),
                    r.get(g.PHONE),
                    r.get(g.OPERATING_HOURS),
                    r.get(g.DAY_PASS_PRICE),
                    Objects.requireNonNullElse(r.get(g.IS_VERIFIED), false),
                    lastVerified != null ? lastVerified.toInstant() : null,
                    r.get(g.CREATED_AT).toInstant(),
                    r.get(g.UPDATED_AT).toInstant(),
                    Objects.requireNonNullElse(r.get(machineCount), 0).longValue(),
                    matched
                );
            });
    }

    public Optional<UUID> findIdByNaverPlaceId(String naverPlaceId) {
        return dsl.select(GYMS.ID)
            .from(GYMS)
            .where(GYMS.NAVER_PLACE_ID.eq(naverPlaceId))
            .fetchOptional(r -> r.get(GYMS.ID));
    }

    public void insertFromNaverPlaces(UUID id, CreateGymRequest req) {
        // Raw SQL for the PostGIS cast: JOOQ's typed insert can't disambiguate the
        // geography Field<Object> overloads, and CLOB-typing the column would lose the
        // GEOGRAPHY(POINT) constraint. is_verified=false marks user-registered gyms so
        // verified Phase 1 seed gyms remain visually distinct.
        dsl.execute(
            """
            INSERT INTO gyms (id, name, address, phone, naver_place_id, is_verified, location)
            VALUES ({0}, {1}, {2}, {3}, {4}, FALSE,
                    ST_SetSRID(ST_MakePoint({5}, {6}), 4326)::geography)
            """,
            DSL.val(id),
            DSL.val(req.name()),
            DSL.val(req.address()),
            DSL.val(req.phone()),
            DSL.val(req.naverPlaceId()),
            DSL.val(req.longitude()),
            DSL.val(req.latitude())
        );
    }

    public Optional<GymDetailResponse> findById(UUID id) {
        Gyms g = GYMS.as("g");
        Field<Double> lat = DSL.field("ST_Y(g.location::geometry)", Double.class);
        Field<Double> lng = DSL.field("ST_X(g.location::geometry)", Double.class);

        return dsl.select(
                g.ID, g.NAME, g.ADDRESS, lat, lng,
                g.PHONE, g.OPERATING_HOURS, g.DAY_PASS_PRICE,
                g.IS_VERIFIED, g.LAST_VERIFIED_AT, g.CREATED_AT, g.UPDATED_AT)
            .from(g)
            .where(g.ID.eq(id))
            .fetchOptional(r -> {
                OffsetDateTime lastVerified = r.get(g.LAST_VERIFIED_AT);
                return new GymDetailResponse(
                    r.get(g.ID),
                    r.get(g.NAME),
                    r.get(g.ADDRESS),
                    Objects.requireNonNullElse(r.get(lat), 0.0),
                    Objects.requireNonNullElse(r.get(lng), 0.0),
                    r.get(g.PHONE),
                    r.get(g.OPERATING_HOURS),
                    r.get(g.DAY_PASS_PRICE),
                    Objects.requireNonNullElse(r.get(g.IS_VERIFIED), false),
                    lastVerified != null ? lastVerified.toInstant() : null,
                    r.get(g.CREATED_AT).toInstant(),
                    r.get(g.UPDATED_AT).toInstant()
                );
            });
    }
}
