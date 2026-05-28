package com.ironspot.machine;

import com.ironspot.jooq.enums.LoadingType;
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
        return dsl.select(
                MACHINE_TEMPLATES.ID,
                MACHINE_TEMPLATES.BRAND_ID,
                BRANDS.NAME,
                BRANDS.NAME_KO,
                MACHINE_TEMPLATES.NAME_EN,
                MACHINE_TEMPLATES.NAME_KO,
                MACHINE_TEMPLATES.SERIES_ID)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateSummary(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(MACHINE_TEMPLATES.BRAND_ID),
                r.get(BRANDS.NAME),
                r.get(BRANDS.NAME_KO),
                r.get(MACHINE_TEMPLATES.NAME_EN),
                r.get(MACHINE_TEMPLATES.NAME_KO),
                r.get(MACHINE_TEMPLATES.SERIES_ID)
            ));
    }

    /**
     * Filter-UI catalog + closed-list picker source. Optional brandId /
     * categoryId / seriesId narrow the result on the server so
     * MachinePicker's TemplateStep can drop its JS-side .filter (Phase 5
     * item 11 slice 3 README follow-up). When all are null returns the
     * full approved set.
     *
     * <p>Phase 5 item 18: both {@code name_en} and {@code name_ko} are
     * projected so the client renders Korean primary on cards + English
     * secondary on detail without an extra request.
     *
     * <p>Phase 5 item 24: {@code brand_name_ko} also projected so the
     * filter accordion / picker / brand chip can lead with Korean.
     *
     * <p>V27 / machine_series: {@code seriesId} filter + projection so the
     * unified brand-or-series picker entry can narrow to a single product
     * line (e.g. LEXCO Master Pro) and the response carries the link for
     * downstream grouping.
     */
    public List<MachineTemplateResponse> findAllApprovedDetailed(UUID brandId, UUID categoryId, UUID seriesId) {
        Condition brandCond = brandId != null
            ? MACHINE_TEMPLATES.BRAND_ID.eq(brandId)
            : DSL.noCondition();
        Condition categoryCond = categoryId != null
            ? MACHINE_TEMPLATES.CATEGORY_ID.eq(categoryId)
            : DSL.noCondition();
        Condition seriesCond = seriesId != null
            ? MACHINE_TEMPLATES.SERIES_ID.eq(seriesId)
            : DSL.noCondition();
        return dsl.select(
                MACHINE_TEMPLATES.ID,
                MACHINE_TEMPLATES.BRAND_ID,
                BRANDS.NAME,
                BRANDS.NAME_KO,
                MACHINE_TEMPLATES.CATEGORY_ID,
                MACHINE_TEMPLATES.NAME_EN,
                MACHINE_TEMPLATES.NAME_KO,
                MACHINE_TEMPLATES.LOADING_TYPE,
                MACHINE_TEMPLATES.SERIES_ID)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .and(brandCond)
            .and(categoryCond)
            .and(seriesCond)
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateResponse(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(MACHINE_TEMPLATES.BRAND_ID),
                r.get(BRANDS.NAME),
                r.get(BRANDS.NAME_KO),
                r.get(MACHINE_TEMPLATES.CATEGORY_ID),
                r.get(MACHINE_TEMPLATES.NAME_EN),
                r.get(MACHINE_TEMPLATES.NAME_KO),
                r.get(MACHINE_TEMPLATES.LOADING_TYPE).getLiteral(),
                r.get(MACHINE_TEMPLATES.SERIES_ID)
            ));
    }

    /**
     * Phase 5 item 11 sub-task 4: admin-created machine_template via the
     * promote action's {@code newTemplate} / {@code newBrandAndTemplate}
     * kinds. Always inserts with {@code is_approved = true} since the create
     * surface is admin-only — there is no "draft" state for templates.
     *
     * <p>{@code categoryId} is nullable per schema (machine_templates only
     * weakly references categories today); the picker forces a selection in
     * the UI but the contract stays permissive for future flows.
     */
    public UUID create(UUID brandId, UUID categoryId, String nameEn, String nameKo, String loadingType) {
        LoadingType lt = LoadingType.lookupLiteral(loadingType);
        return dsl.insertInto(MACHINE_TEMPLATES)
            .set(MACHINE_TEMPLATES.BRAND_ID, brandId)
            .set(MACHINE_TEMPLATES.CATEGORY_ID, categoryId)
            .set(MACHINE_TEMPLATES.NAME_EN, nameEn)
            .set(MACHINE_TEMPLATES.NAME_KO, nameKo)
            .set(MACHINE_TEMPLATES.LOADING_TYPE, lt)
            .set(MACHINE_TEMPLATES.IS_APPROVED, true)
            .returning(MACHINE_TEMPLATES.ID)
            .fetchOne()
            .get(MACHINE_TEMPLATES.ID);
    }

    public List<MachineTemplateSummary> findApprovedByOptionalFilters(UUID brandId, UUID categoryId) {
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
                BRANDS.NAME_KO,
                MACHINE_TEMPLATES.NAME_EN,
                MACHINE_TEMPLATES.NAME_KO,
                MACHINE_TEMPLATES.SERIES_ID)
            .from(MACHINE_TEMPLATES)
            .join(BRANDS).on(MACHINE_TEMPLATES.BRAND_ID.eq(BRANDS.ID))
            .where(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .and(brandCond)
            .and(categoryCond)
            .orderBy(BRANDS.NAME, MACHINE_TEMPLATES.NAME_EN)
            .fetch(r -> new MachineTemplateSummary(
                r.get(MACHINE_TEMPLATES.ID),
                r.get(MACHINE_TEMPLATES.BRAND_ID),
                r.get(BRANDS.NAME),
                r.get(BRANDS.NAME_KO),
                r.get(MACHINE_TEMPLATES.NAME_EN),
                r.get(MACHINE_TEMPLATES.NAME_KO),
                r.get(MACHINE_TEMPLATES.SERIES_ID)
            ));
    }
}
