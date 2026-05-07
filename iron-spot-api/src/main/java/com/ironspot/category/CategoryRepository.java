package com.ironspot.category;

import com.ironspot.category.dto.CategoryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.EmptySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class CategoryRepository {

    private static final RowMapper<CategoryResponse> ROW_MAPPER =
        (rs, rowNum) -> new CategoryResponse(
            UUID.fromString(rs.getString("id")),
            rs.getString("name")
        );

    private final NamedParameterJdbcTemplate jdbc;

    public List<CategoryResponse> findAll() {
        return jdbc.query(
            "SELECT id, name FROM categories ORDER BY name",
            EmptySqlParameterSource.INSTANCE,
            ROW_MAPPER
        );
    }
}
