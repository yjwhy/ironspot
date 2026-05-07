package com.ironspot.brand;

import com.ironspot.brand.dto.BrandResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.EmptySqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class BrandRepository {

    private static final RowMapper<BrandResponse> ROW_MAPPER =
        (rs, rowNum) -> new BrandResponse(
            UUID.fromString(rs.getString("id")),
            rs.getString("name")
        );

    private final NamedParameterJdbcTemplate jdbc;

    public List<BrandResponse> findAll() {
        return jdbc.query(
            "SELECT id, name FROM brands ORDER BY name",
            EmptySqlParameterSource.INSTANCE,
            ROW_MAPPER
        );
    }
}
