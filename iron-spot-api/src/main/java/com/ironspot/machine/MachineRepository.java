package com.ironspot.machine;

import com.ironspot.machine.dto.GymMachineResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class MachineRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static RowMapper<GymMachineResponse> machineRowMapper() {
        return (rs, rowNum) -> {
            String templateId = rs.getString("template_id");
            String brandId = rs.getString("brand_id");
            String categoryId = rs.getString("category_id");
            return new GymMachineResponse(
                UUID.fromString(rs.getString("id")),
                rs.getInt("quantity"),
                rs.getBoolean("is_custom"),
                rs.getString("custom_name"),
                rs.getTimestamp("last_verified_at") != null
                    ? rs.getTimestamp("last_verified_at").toInstant() : null,
                templateId != null ? UUID.fromString(templateId) : null,
                rs.getString("machine_name"),
                rs.getString("loading_type"),
                brandId != null ? UUID.fromString(brandId) : null,
                rs.getString("brand_name"),
                categoryId != null ? UUID.fromString(categoryId) : null,
                rs.getString("category_name"),
                rs.getLong("photo_count")
            );
        };
    }

    public List<GymMachineResponse> findByGymId(UUID gymId) {
        String sql = """
            SELECT
                gm.id, gm.quantity, gm.is_custom, gm.custom_name, gm.last_verified_at,
                mt.id AS template_id, mt.name AS machine_name, mt.loading_type,
                b.id AS brand_id, b.name AS brand_name,
                c.id AS category_id, c.name AS category_name,
                COUNT(mp.id) AS photo_count
            FROM gym_machines gm
            JOIN machine_templates mt ON mt.id = gm.template_id
            JOIN brands b ON b.id = mt.brand_id
            JOIN categories c ON c.id = mt.category_id
            LEFT JOIN machine_photos mp ON mp.gym_machine_id = gm.id AND mp.is_blinded = FALSE
            WHERE gm.gym_id = :gymId
            GROUP BY gm.id, mt.id, b.id, c.id
            ORDER BY b.name, c.name, mt.name
            """;
        return jdbc.query(sql, new MapSqlParameterSource("gymId", gymId), machineRowMapper());
    }
}
