package com.ironspot.gym;

import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.jooq.enums.LoadingType;
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
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.*;

@Repository
@RequiredArgsConstructor
public class GymRepository {

    private final DSLContext dsl;

    public List<GymWithMachineCountResponse> searchInBounds(GymSearchRequest req) {
        Gyms g = GYMS.as("g");
        GymMachines gm = GYM_MACHINES.as("gm");
        MachineTemplates mt = MACHINE_TEMPLATES.as("mt");

        Field<Double> lat = DSL.field("ST_Y(g.location::geometry)", Double.class);
        Field<Double> lng = DSL.field("ST_X(g.location::geometry)", Double.class);
        Field<Integer> machineCount = DSL.countDistinct(gm.ID).as("machine_count");

        Condition spatialCond = DSL.condition(
            "ST_Within(g.location::geometry, ST_MakeEnvelope({0}, {1}, {2}, {3}, 4326))",
            DSL.val(req.getMinLng()), DSL.val(req.getMinLat()),
            DSL.val(req.getMaxLng()), DSL.val(req.getMaxLat())
        );

        Condition brandCond = req.getBrandId() != null
            ? mt.BRAND_ID.eq(UUID.fromString(req.getBrandId()))
            : DSL.noCondition();

        Condition categoryCond = req.getCategoryId() != null
            ? mt.CATEGORY_ID.eq(UUID.fromString(req.getCategoryId()))
            : DSL.noCondition();

        Condition loadingCond = req.getLoadingType() != null
            ? mt.LOADING_TYPE.eq(LoadingType.lookupLiteral(req.getLoadingType()))
            : DSL.noCondition();

        return dsl.select(
                g.ID, g.NAME, g.ADDRESS, lat, lng,
                g.PHONE, g.OPERATING_HOURS, g.DAY_PASS_PRICE,
                g.IS_VERIFIED, g.LAST_VERIFIED_AT, g.CREATED_AT, g.UPDATED_AT,
                machineCount)
            .from(g)
            .leftJoin(gm).on(gm.GYM_ID.eq(g.ID))
            .leftJoin(mt).on(mt.ID.eq(gm.TEMPLATE_ID))
            .where(spatialCond)
            .and(brandCond)
            .and(categoryCond)
            .and(loadingCond)
            .groupBy(g.ID, g.NAME, g.ADDRESS, g.PHONE, g.OPERATING_HOURS,
                g.DAY_PASS_PRICE, g.IS_VERIFIED, g.LAST_VERIFIED_AT,
                g.CREATED_AT, g.UPDATED_AT)
            .orderBy(machineCount.desc())
            .fetch(r -> {
                OffsetDateTime lastVerified = r.get(g.LAST_VERIFIED_AT);
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
                    Objects.requireNonNullElse(r.get(machineCount), 0).longValue()
                );
            });
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
