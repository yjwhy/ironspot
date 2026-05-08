package com.ironspot.category;

import com.ironspot.category.dto.CategoryResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;

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
}
