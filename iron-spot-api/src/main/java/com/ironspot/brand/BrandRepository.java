package com.ironspot.brand;

import com.ironspot.brand.dto.BrandResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.BRANDS;

@Repository
@RequiredArgsConstructor
public class BrandRepository {

    private final DSLContext dsl;

    public List<BrandResponse> findAll() {
        return dsl.select(BRANDS.ID, BRANDS.NAME)
            .from(BRANDS)
            .orderBy(BRANDS.NAME)
            .fetch(r -> new BrandResponse(r.get(BRANDS.ID), r.get(BRANDS.NAME)));
    }

    public Optional<UUID> findIdByNameIgnoreCase(String name) {
        return dsl.select(BRANDS.ID)
            .from(BRANDS)
            .where(DSL.upper(BRANDS.NAME).eq(name.toUpperCase(Locale.ROOT)))
            .fetchOptional(r -> r.get(BRANDS.ID));
    }

    /**
     * Phase 5 item 11 sub-task 4: admin-created brand from the promote
     * action's {@code newBrandAndTemplate} kind. Returns the new id so the
     * caller can chain into MachineTemplateRepository.create. The unique
     * constraint on {@code brands.name} bubbles up as a
     * {@link org.springframework.dao.DuplicateKeyException} for the service
     * to map to 409.
     */
    public UUID create(String name) {
        return dsl.insertInto(BRANDS)
            .set(BRANDS.NAME, name)
            .returning(BRANDS.ID)
            .fetchOne()
            .get(BRANDS.ID);
    }

    /**
     * Phase 5 item 11 sub-task 4: existence check for the brandId field on
     * {@code PromoteContributionRequest.NewTemplate}. The service returns
     * 404 when the picker hands back a stale brand id.
     */
    public boolean existsById(UUID brandId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(BRANDS)
                .where(BRANDS.ID.eq(brandId))
        );
    }
}
