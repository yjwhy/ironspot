package com.ironspot.machine;

import com.ironspot.machine.dto.MachineTemplateResponse;
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
        return dsl.select(MACHINE_TEMPLATES.ID, BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN, MACHINE_TEMPLATES.NAME_KO)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateSummary(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(BRANDS.NAME),
                r.get(MACHINE_TEMPLATES.NAME_EN),
                r.get(MACHINE_TEMPLATES.NAME_KO)
            ));
    }

    /**
     * Filter-UI catalog + closed-list picker source. Optional brandId /
     * categoryId narrow the result on the server so MachinePicker's
     * TemplateStep can drop its JS-side .filter (Phase 5 item 11 slice 3
     * README follow-up). When both are null returns the full approved set.
     *
     * <p>Phase 5 item 18: both {@code name_en} and {@code name_ko} are
     * projected so the client renders Korean primary on cards + English
     * secondary on detail without an extra request.
     */
    public List<MachineTemplateResponse> findAllApprovedDetailed(UUID brandId, UUID categoryId) {
        Condition brandCond = brandId != null
            ? MACHINE_TEMPLATES.BRAND_ID.eq(brandId)
            : DSL.noCondition();
        Condition categoryCond = categoryId != null
            ? MACHINE_TEMPLATES.CATEGORY_ID.eq(categoryId)
            : DSL.noCondition();
        return dsl.select(
                MACHINE_TEMPLATES.ID,
                MACHINE_TEMPLATES.BRAND_ID,
                BRANDS.NAME,
                MACHINE_TEMPLATES.CATEGORY_ID,
                MACHINE_TEMPLATES.NAME_EN,
                MACHINE_TEMPLATES.NAME_KO,
                MACHINE_TEMPLATES.LOADING_TYPE)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .and(brandCond)
            .and(categoryCond)
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateResponse(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(MACHINE_TEMPLATES.BRAND_ID),
                r.get(BRANDS.NAME),
                r.get(MACHINE_TEMPLATES.CATEGORY_ID),
                r.get(MACHINE_TEMPLATES.NAME_EN),
                r.get(MACHINE_TEMPLATES.NAME_KO),
                r.get(MACHINE_TEMPLATES.LOADING_TYPE).getLiteral()
            ));
    }

    public List<MachineTemplateSummary> findApprovedByOptionalFilters(UUID brandId, UUID categoryId) {
        Condition brandCond = brandId != null
            ? MACHINE_TEMPLATES.BRAND_ID.eq(brandId)
            : DSL.noCondition();
        Condition categoryCond = categoryId != null
            ? MACHINE_TEMPLATES.CATEGORY_ID.eq(categoryId)
            : DSL.noCondition();
        return dsl.select(MACHINE_TEMPLATES.ID, BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN, MACHINE_TEMPLATES.NAME_KO)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .and(brandCond)
            .and(categoryCond)
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateSummary(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(BRANDS.NAME),
                r.get(MACHINE_TEMPLATES.NAME_EN),
                r.get(MACHINE_TEMPLATES.NAME_KO)
            ));
    }
}
