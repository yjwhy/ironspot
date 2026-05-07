package com.ironspot.photo;

import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class PhotoRepository {

    private final NamedParameterJdbcTemplate jdbc;

    private static RowMapper<PhotoResponse> photoRowMapper() {
        return (rs, rowNum) -> {
            String userId = rs.getString("user_id");
            java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
            return new PhotoResponse(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("gym_machine_id")),
                userId != null ? UUID.fromString(userId) : null,
                rs.getString("photo_url"),
                rs.getInt("upvote_count"),
                createdAt != null ? createdAt.toInstant() : null
            );
        };
    }

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        String sql = """
            SELECT id, gym_machine_id, user_id, photo_url, upvote_count, created_at
            FROM machine_photos
            WHERE gym_machine_id = :gymMachineId
              AND is_blinded = FALSE
            ORDER BY upvote_count DESC, created_at DESC
            """;
        return jdbc.query(sql, new MapSqlParameterSource("gymMachineId", gymMachineId), photoRowMapper());
    }
}
