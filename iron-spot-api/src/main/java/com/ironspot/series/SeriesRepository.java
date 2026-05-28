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
}
