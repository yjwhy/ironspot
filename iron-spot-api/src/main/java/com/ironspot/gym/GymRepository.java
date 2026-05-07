package com.ironspot.gym;

import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.sql.Types;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class GymRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static RowMapper<GymWithMachineCountResponse> gymWithMachineCountRowMapper() {
        return (rs, rowNum) -> new GymWithMachineCountResponse(
            UUID.fromString(rs.getString("id")),
            rs.getString("name"),
            rs.getString("address"),
            rs.getDouble("latitude"),
            rs.getDouble("longitude"),
            rs.getString("phone"),
            rs.getString("operating_hours"),
            (Integer) rs.getObject("day_pass_price"),
            rs.getBoolean("is_verified"),
            rs.getTimestamp("last_verified_at") != null
                ? rs.getTimestamp("last_verified_at").toInstant() : null,
            rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant(),
            rs.getLong("machine_count")
        );
    }

    private static RowMapper<GymDetailResponse> gymDetailRowMapper() {
        return (rs, rowNum) -> new GymDetailResponse(
            UUID.fromString(rs.getString("id")),
            rs.getString("name"),
            rs.getString("address"),
            rs.getDouble("latitude"),
            rs.getDouble("longitude"),
            rs.getString("phone"),
            rs.getString("operating_hours"),
            (Integer) rs.getObject("day_pass_price"),
            rs.getBoolean("is_verified"),
            rs.getTimestamp("last_verified_at") != null
                ? rs.getTimestamp("last_verified_at").toInstant() : null,
            rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant()
        );
    }

    public List<GymWithMachineCountResponse> searchInBounds(GymSearchRequest req) {
        String sql = """
            SELECT
                g.id, g.name, g.address,
                ST_Y(g.location::geometry) AS latitude,
                ST_X(g.location::geometry) AS longitude,
                g.phone, g.operating_hours, g.day_pass_price,
                g.is_verified, g.last_verified_at,
                g.created_at, g.updated_at,
                COUNT(DISTINCT gm.id) AS machine_count
            FROM gyms g
            LEFT JOIN gym_machines gm ON gm.gym_id = g.id
            LEFT JOIN machine_templates mt ON mt.id = gm.template_id
            WHERE ST_Within(
                g.location::geometry,
                ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)
            )
            AND (:brandId IS NULL OR mt.brand_id::text = :brandId)
            AND (:categoryId IS NULL OR mt.category_id::text = :categoryId)
            AND (:loadingType IS NULL OR mt.loading_type::text = :loadingType)
            GROUP BY g.id
            ORDER BY machine_count DESC
            """;
        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("minLat", req.getMinLat())
            .addValue("maxLat", req.getMaxLat())
            .addValue("minLng", req.getMinLng())
            .addValue("maxLng", req.getMaxLng())
            .addValue("brandId", req.getBrandId(), Types.VARCHAR)
            .addValue("categoryId", req.getCategoryId(), Types.VARCHAR)
            .addValue("loadingType", req.getLoadingType(), Types.VARCHAR);
        return jdbc.query(sql, params, gymWithMachineCountRowMapper());
    }

    public Optional<GymDetailResponse> findById(UUID id) {
        String sql = """
            SELECT
                g.id, g.name, g.address,
                ST_Y(g.location::geometry) AS latitude,
                ST_X(g.location::geometry) AS longitude,
                g.phone, g.operating_hours, g.day_pass_price,
                g.is_verified, g.last_verified_at,
                g.created_at, g.updated_at
            FROM gyms g
            WHERE g.id = :id
            """;
        MapSqlParameterSource params = new MapSqlParameterSource("id", id);
        List<GymDetailResponse> results = jdbc.query(sql, params, gymDetailRowMapper());
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }
}
