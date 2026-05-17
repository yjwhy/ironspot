package com.ironspot.search;

import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.jooq.tables.GymMachines;
import com.ironspot.jooq.tables.Gyms;
import com.ironspot.jooq.tables.MachineTemplates;
import com.ironspot.search.dsl.SearchScope;
import lombok.RequiredArgsConstructor;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

import static com.ironspot.jooq.Tables.GYM_MACHINES;
import static com.ironspot.jooq.Tables.GYMS;
import static com.ironspot.jooq.Tables.MACHINE_TEMPLATES;

@Component
@RequiredArgsConstructor
public class SqlBuilder {

    private static final int MAX_RESULTS = 50;

    private final DSLContext dsl;

    public List<GymWithMachineCountResponse> execute(ResolvedLocation location, List<ResolvedFilter> filters) {
        Gyms g = GYMS.as("g");
        GymMachines gm = GYM_MACHINES.as("gm");

        double lng = location.coordinates().lng();
        double lat = location.coordinates().lat();
        double radiusMeters = location.radiusKm() * 1000.0;

        Field<Double> latField = DSL.field("ST_Y({0}::geometry)", Double.class, g.LOCATION);
        Field<Double> lngField = DSL.field("ST_X({0}::geometry)", Double.class, g.LOCATION);
        Field<Integer> machineCount = DSL.countDistinct(gm.ID).as("machine_count");
        Field<Double> distance = DSL.field(
            "ST_Distance({0}::geography, ST_SetSRID(ST_MakePoint({1}, {2}), 4326)::geography)",
            Double.class, g.LOCATION, DSL.val(lng), DSL.val(lat)
        );

        Condition spatial = DSL.condition(
            "ST_DWithin({0}::geography, ST_SetSRID(ST_MakePoint({1}, {2}), 4326)::geography, {3})",
            g.LOCATION, DSL.val(lng), DSL.val(lat), DSL.val(radiusMeters)
        );

        Condition filterCondition = buildFilterCondition(filters, g);

        return dsl.select(
                g.ID, g.NAME, g.ADDRESS, latField, lngField,
                g.PHONE, g.OPERATING_HOURS, g.DAY_PASS_PRICE,
                g.IS_VERIFIED, g.LAST_VERIFIED_AT, g.CREATED_AT, g.UPDATED_AT,
                machineCount, distance.as("distance"))
            .from(g)
            .leftJoin(gm).on(gm.GYM_ID.eq(g.ID))
            .where(spatial)
            .and(filterCondition)
            .groupBy(g.ID, g.NAME, g.ADDRESS, g.PHONE, g.OPERATING_HOURS,
                g.DAY_PASS_PRICE, g.IS_VERIFIED, g.LAST_VERIFIED_AT,
                g.CREATED_AT, g.UPDATED_AT, g.LOCATION)
            .orderBy(distance.asc())
            .limit(MAX_RESULTS)
            .fetch(r -> {
                OffsetDateTime lastVerified = r.get(g.LAST_VERIFIED_AT);
                return new GymWithMachineCountResponse(
                    r.get(g.ID),
                    r.get(g.NAME),
                    r.get(g.ADDRESS),
                    Objects.requireNonNullElse(r.get(latField), 0.0),
                    Objects.requireNonNullElse(r.get(lngField), 0.0),
                    r.get(g.PHONE),
                    r.get(g.OPERATING_HOURS),
                    r.get(g.DAY_PASS_PRICE),
                    Objects.requireNonNullElse(r.get(g.IS_VERIFIED), false),
                    lastVerified != null ? lastVerified.toInstant() : null,
                    r.get(g.CREATED_AT).toInstant(),
                    r.get(g.UPDATED_AT).toInstant(),
                    Objects.requireNonNullElse(r.get(machineCount), 0).longValue(),
                    // ADR 0022 / Slice 45d: NL Search path 는 EXISTS 기반 필터링으로
                    // matched machine names 집계가 더 복잡 (compound machineFilters).
                    // 일단 빈 리스트 반환. 후속 Task 에서 NL Search 응답에도
                    // 매칭 머신 이름 노출 검토.
                    List.of()
                );
            });
    }

    private Condition buildFilterCondition(List<ResolvedFilter> filters, Gyms g) {
        if (filters.isEmpty()) return DSL.noCondition();
        SearchScope scope = filters.get(0).scope();
        if (scope == SearchScope.COMBINED) {
            return buildCombinedExists(filters, g);
        }
        Condition combined = DSL.noCondition();
        for (int i = 0; i < filters.size(); i++) {
            combined = combined.and(buildEachExists(filters.get(i), g, i));
        }
        return combined;
    }

    private Condition buildEachExists(ResolvedFilter filter, Gyms g, int index) {
        MachineTemplates mt = MACHINE_TEMPLATES.as("mt_each_" + index);
        GymMachines gmInner = GYM_MACHINES.as("gm_each_" + index);
        return DSL.exists(
            dsl.selectOne()
                .from(gmInner)
                .join(mt).on(mt.ID.eq(gmInner.TEMPLATE_ID))
                .where(gmInner.GYM_ID.eq(g.ID))
                .and(matchesFilter(filter, mt))
                .groupBy(gmInner.GYM_ID)
                .having(DSL.sum(gmInner.QUANTITY).ge(BigDecimal.valueOf(filter.minCount())))
        );
    }

    private Condition buildCombinedExists(List<ResolvedFilter> filters, Gyms g) {
        MachineTemplates mt = MACHINE_TEMPLATES.as("mt_combined");
        GymMachines gmInner = GYM_MACHINES.as("gm_combined");
        Condition match = filters.stream()
            .map(f -> matchesFilter(f, mt))
            .reduce(Condition::or)
            .orElseThrow(() -> new IllegalStateException("combined scope requires at least one filter"));
        int threshold = filters.get(0).minCount();
        return DSL.exists(
            dsl.selectOne()
                .from(gmInner)
                .join(mt).on(mt.ID.eq(gmInner.TEMPLATE_ID))
                .where(gmInner.GYM_ID.eq(g.ID))
                .and(match)
                .groupBy(gmInner.GYM_ID)
                .having(DSL.sum(gmInner.QUANTITY).ge(BigDecimal.valueOf(threshold)))
        );
    }

    private Condition matchesFilter(ResolvedFilter filter, MachineTemplates mt) {
        Condition cond = DSL.noCondition();
        if (filter.templateIds() != null && !filter.templateIds().isEmpty()) {
            return cond.and(mt.ID.in(filter.templateIds()));
        }
        if (filter.brandId() != null) cond = cond.and(mt.BRAND_ID.eq(filter.brandId()));
        if (filter.categoryId() != null) cond = cond.and(mt.CATEGORY_ID.eq(filter.categoryId()));
        return cond;
    }
}
