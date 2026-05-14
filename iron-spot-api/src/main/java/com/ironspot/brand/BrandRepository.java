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
}
