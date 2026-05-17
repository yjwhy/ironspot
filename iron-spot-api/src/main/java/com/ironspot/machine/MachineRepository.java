package com.ironspot.machine;

import com.ironspot.jooq.enums.LoadingType;
import com.ironspot.jooq.tables.Brands;
import com.ironspot.jooq.tables.Categories;
import com.ironspot.jooq.tables.GymMachines;
import com.ironspot.jooq.tables.MachineTemplates;
import com.ironspot.machine.dto.GymMachineResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static com.ironspot.jooq.Tables.*;

@Repository
@RequiredArgsConstructor
public class MachineRepository {

    private final DSLContext dsl;

    public List<GymMachineResponse> findByGymId(UUID gymId) {
        GymMachines gm = GYM_MACHINES.as("gm");
        MachineTemplates mt = MACHINE_TEMPLATES.as("mt");
        Brands b = BRANDS.as("b");
        Categories c = CATEGORIES.as("c");

        Field<UUID> templateIdField = mt.ID.as("template_id");
        Field<String> machineNameField = mt.NAME.as("machine_name");
        Field<UUID> brandIdField = b.ID.as("brand_id");
        Field<String> brandNameField = b.NAME.as("brand_name");
        Field<UUID> categoryIdField = c.ID.as("category_id");
        Field<String> categoryNameField = c.NAME.as("category_name");

        return dsl.select(
                gm.ID, gm.QUANTITY, gm.IS_CUSTOM, gm.CUSTOM_NAME, gm.LAST_VERIFIED_AT,
                templateIdField, machineNameField, mt.LOADING_TYPE,
                brandIdField, brandNameField, categoryIdField, categoryNameField)
            .from(gm)
            .join(mt).on(mt.ID.eq(gm.TEMPLATE_ID))
            .join(b).on(b.ID.eq(mt.BRAND_ID))
            .join(c).on(c.ID.eq(mt.CATEGORY_ID))
            .where(gm.GYM_ID.eq(gymId))
            .orderBy(b.NAME, c.NAME, mt.NAME)
            .fetch(r -> {
                OffsetDateTime lastVerified = r.get(gm.LAST_VERIFIED_AT);
                LoadingType lt = r.get(mt.LOADING_TYPE);
                return new GymMachineResponse(
                    r.get(gm.ID),
                    Objects.requireNonNullElse(r.get(gm.QUANTITY), 1),
                    Objects.requireNonNullElse(r.get(gm.IS_CUSTOM), false),
                    r.get(gm.CUSTOM_NAME),
                    lastVerified != null ? lastVerified.toInstant() : null,
                    r.get(templateIdField),
                    r.get(machineNameField),
                    lt != null ? lt.getLiteral() : null,
                    r.get(brandIdField),
                    r.get(brandNameField),
                    r.get(categoryIdField),
                    r.get(categoryNameField),
                    List.of()
                );
            });
    }

    /**
     * Admin-screen detail for a gym_machine row. ADR 0022 follow-up (Task 46)
     * Slice 46h. Returns enough metadata for admin to decide between re-template
     * / delete / dismiss without an additional round-trip. Pending reports are
     * fetched separately at the service layer (they live in REPORTS, not here).
     */
    public java.util.Optional<com.ironspot.admin.dto.AdminGymMachineDetailResponse> findAdminDetail(UUID gymMachineId) {
        return dsl.select(
                GYM_MACHINES.ID,
                GYM_MACHINES.GYM_ID,
                com.ironspot.jooq.Tables.GYMS.NAME.as("gym_name"),
                GYM_MACHINES.TEMPLATE_ID,
                BRANDS.NAME.as("brand_name"),
                MACHINE_TEMPLATES.NAME.as("template_name"),
                MACHINE_TEMPLATES.LOADING_TYPE,
                GYM_MACHINES.QUANTITY)
            .from(GYM_MACHINES)
            .join(com.ironspot.jooq.Tables.GYMS).on(com.ironspot.jooq.Tables.GYMS.ID.eq(GYM_MACHINES.GYM_ID))
            .leftJoin(MACHINE_TEMPLATES).on(MACHINE_TEMPLATES.ID.eq(GYM_MACHINES.TEMPLATE_ID))
            .leftJoin(BRANDS).on(BRANDS.ID.eq(MACHINE_TEMPLATES.BRAND_ID))
            .where(GYM_MACHINES.ID.eq(gymMachineId))
            .fetchOptional(r -> {
                var loading = r.get(MACHINE_TEMPLATES.LOADING_TYPE);
                return new com.ironspot.admin.dto.AdminGymMachineDetailResponse(
                    r.get(GYM_MACHINES.ID),
                    r.get(GYM_MACHINES.GYM_ID),
                    r.get("gym_name", String.class),
                    r.get(GYM_MACHINES.TEMPLATE_ID),
                    r.get("brand_name", String.class),
                    r.get("template_name", String.class),
                    loading != null ? loading.getLiteral() : null,
                    Objects.requireNonNullElse(r.get(GYM_MACHINES.QUANTITY), 1),
                    List.of()
                );
            });
    }

    /**
     * Update a gym_machine row's template_id. ADR 0022 follow-up (Task 46):
     * admin disposition for WRONG_TEMPLATE reports re-maps the gym_machine to
     * a different (brand, model) tuple. Returns rows affected for race-safe checks.
     */
    public int updateTemplateId(UUID gymMachineId, UUID newTemplateId) {
        return dsl.update(GYM_MACHINES)
            .set(GYM_MACHINES.TEMPLATE_ID, newTemplateId)
            .where(GYM_MACHINES.ID.eq(gymMachineId))
            .execute();
    }

    /**
     * Delete a gym_machine row. Photos referencing this row cascade via the FK
     * (machine_photos.gym_machine_id REFERENCES gym_machines(id)). ADR 0022
     * follow-up (Task 46): admin disposition for NOT_PRESENT reports.
     */
    public int deleteById(UUID gymMachineId) {
        return dsl.deleteFrom(GYM_MACHINES)
            .where(GYM_MACHINES.ID.eq(gymMachineId))
            .execute();
    }

    /**
     * Check that a template exists and is approved — used before re-template
     * disposition so admin cannot point a gym_machine at a non-existent template.
     */
    public boolean templateExistsAndApproved(UUID templateId) {
        Integer count = dsl.selectCount()
            .from(MACHINE_TEMPLATES)
            .where(MACHINE_TEMPLATES.ID.eq(templateId))
            .and(MACHINE_TEMPLATES.IS_APPROVED.isTrue())
            .fetchOneInto(Integer.class);
        return Objects.requireNonNullElse(count, 0) > 0;
    }
}
