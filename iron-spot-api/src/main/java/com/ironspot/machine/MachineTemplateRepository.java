package com.ironspot.machine;

import lombok.RequiredArgsConstructor;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import static com.ironspot.jooq.Tables.*;

@Repository
@RequiredArgsConstructor
public class MachineTemplateRepository {

    private final DSLContext dsl;

    public List<MachineTemplateSummary> findAllApproved() {
        return dsl.select(MACHINE_TEMPLATES.ID, BRANDS.NAME, MACHINE_TEMPLATES.NAME)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME)
            .fetch(r -> new MachineTemplateSummary(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(BRANDS.NAME),
                r.get(MACHINE_TEMPLATES.NAME)
            ));
    }

    public List<MachineTemplateSummary> findApprovedByOptionalFilters(UUID brandId, UUID categoryId) {
        Condition brandCond = brandId != null
            ? MACHINE_TEMPLATES.BRAND_ID.eq(brandId)
            : DSL.noCondition();
        Condition categoryCond = categoryId != null
            ? MACHINE_TEMPLATES.CATEGORY_ID.eq(categoryId)
            : DSL.noCondition();
        return dsl.select(MACHINE_TEMPLATES.ID, BRANDS.NAME, MACHINE_TEMPLATES.NAME)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .and(brandCond)
            .and(categoryCond)
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME)
            .fetch(r -> new MachineTemplateSummary(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(BRANDS.NAME),
                r.get(MACHINE_TEMPLATES.NAME)
            ));
    }
}
