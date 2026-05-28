package com.ironspot.series;

import com.ironspot.series.dto.SeriesResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;

import static com.ironspot.jooq.Tables.BRANDS;
import static com.ironspot.jooq.Tables.MACHINE_SERIES;

@Repository
@RequiredArgsConstructor
public class SeriesRepository {

    private final DSLContext dsl;

    /**
     * Returns the full series catalog ordered by brand name then series
     * name. Catalog is closed and small (~74 rows at launch) so the client
     * fetches everything once and narrows with offline fuzzy matching, the
     * same pattern as {@link com.ironspot.brand.BrandRepository#findAll}.
     */
    public List<SeriesResponse> findAll() {
        return dsl.select(
                MACHINE_SERIES.ID,
                MACHINE_SERIES.BRAND_ID,
                MACHINE_SERIES.NAME,
                MACHINE_SERIES.NAME_KO)
            .from(MACHINE_SERIES)
            .join(BRANDS).on(MACHINE_SERIES.BRAND_ID.eq(BRANDS.ID))
            .orderBy(BRANDS.NAME, MACHINE_SERIES.NAME)
            .fetch(r -> new SeriesResponse(
                r.get(MACHINE_SERIES.ID),
                r.get(MACHINE_SERIES.BRAND_ID),
                r.get(MACHINE_SERIES.NAME),
                r.get(MACHINE_SERIES.NAME_KO)));
    }

    /**
     * V27 / admin promote: create a new series under a brand. Mirrors
     * {@link com.ironspot.brand.BrandRepository#create}. The UNIQUE
     * (brand_id, name) constraint bubbles up as a
     * {@link org.springframework.dao.DuplicateKeyException} for the caller
     * to map to 409. Per the English-only naming policy seeded in V27,
     * {@code nameKo} is expected to equal {@code name} on the wire.
     */
    public java.util.UUID create(java.util.UUID brandId, String name, String nameKo) {
        return dsl.insertInto(MACHINE_SERIES)
            .set(MACHINE_SERIES.BRAND_ID, brandId)
            .set(MACHINE_SERIES.NAME, name)
            .set(MACHINE_SERIES.NAME_KO, nameKo)
            .returning(MACHINE_SERIES.ID)
            .fetchOne()
            .get(MACHINE_SERIES.ID);
    }

    /**
     * V27 / admin promote: verify a series id belongs to the given brand.
     * The promote action lets the admin pick an existing series under
     * {@code brandId}; without this guard a stale picker could attach a
     * template to a series of the wrong brand.
     */
    public boolean existsByIdAndBrand(java.util.UUID seriesId, java.util.UUID brandId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(MACHINE_SERIES)
                .where(MACHINE_SERIES.ID.eq(seriesId))
                .and(MACHINE_SERIES.BRAND_ID.eq(brandId)));
    }
}
