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
     * Filter-UI catalog. Includes brandId/categoryId/loadingType so the client
     * can render the chip label as "{brandName} {name} · {loadingType}" and
     * cross-reference brand/운동 부위 filters. ADR 0022 / Task 45.
     *
     * <p>Slice (a) of item 18 only renames the underlying column to NAME_EN;
     * the Response shape (and the JSON field `name`) is unchanged here so the
     * Orval-generated client keeps compiling until slice (b)/(c) adds nameKo
     * to the wire contract.
     */
    public List<MachineTemplateResponse> findAllApprovedDetailed() {
        return dsl.select(
                MACHINE_TEMPLATES.ID,
                MACHINE_TEMPLATES.BRAND_ID,
                BRANDS.NAME,
                MACHINE_TEMPLATES.CATEGORY_ID,
                MACHINE_TEMPLATES.NAME_EN,
                MACHINE_TEMPLATES.LOADING_TYPE)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateResponse(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(MACHINE_TEMPLATES.BRAND_ID),
                r.get(BRANDS.NAME),
                r.get(MACHINE_TEMPLATES.CATEGORY_ID),
                r.get(MACHINE_TEMPLATES.NAME_EN),
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
