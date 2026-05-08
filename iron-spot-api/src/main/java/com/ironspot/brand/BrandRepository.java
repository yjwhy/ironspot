package com.ironspot.brand;

import com.ironspot.brand.dto.BrandResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}
