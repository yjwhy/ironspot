package com.ironspot.category;

import com.ironspot.category.dto.CategoryResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.CATEGORIES;

@Repository
@RequiredArgsConstructor
public class CategoryRepository {

    private final DSLContext dsl;

    public List<CategoryResponse> findAll() {
        return dsl.select(CATEGORIES.ID, CATEGORIES.NAME)
            .from(CATEGORIES)
            .orderBy(CATEGORIES.NAME)
            .fetch(r -> new CategoryResponse(r.get(CATEGORIES.ID), r.get(CATEGORIES.NAME)));
    }

    public Optional<UUID> findIdByNameIgnoreCase(String name) {
        return dsl.select(CATEGORIES.ID)
            .from(CATEGORIES)
            .where(DSL.upper(CATEGORIES.NAME).eq(name.toUpperCase(Locale.ROOT)))
            .fetchOptional(r -> r.get(CATEGORIES.ID));
    }
}
