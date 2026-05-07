package com.ironspot.auth;

import com.ironspot.auth.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final JdbcTemplate jdbc;

    public Optional<UserResponse> findById(String id) {
        try {
            return Optional.ofNullable(
                jdbc.queryForObject(
                    "SELECT id, email, nickname, created_at FROM users WHERE id = ?::uuid AND deleted_at IS NULL",
                    UserRowMapper.INSTANCE, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void insert(String id, String email, String nickname) {
        jdbc.update(
            "INSERT INTO users (id, email, nickname) VALUES (?::uuid, ?, ?) ON CONFLICT (id) DO NOTHING",
            id, email, nickname);
    }

    public int updateNickname(String userId, String nickname) {
        return jdbc.update(
            "UPDATE users SET nickname = ?, updated_at = NOW() WHERE id = ?::uuid AND deleted_at IS NULL",
            nickname, userId);
    }

    public void anonymizePhotos(String userId) {
        jdbc.update(
            "UPDATE machine_photos SET user_id = NULL WHERE user_id = ?::uuid",
            userId);
    }

    public void deleteVotes(String userId) {
        jdbc.update("DELETE FROM photo_votes WHERE user_id = ?::uuid", userId);
    }

    public int markDeleted(String userId) {
        return jdbc.update(
            "UPDATE users SET deleted_at = NOW() WHERE id = ?::uuid AND deleted_at IS NULL",
            userId);
    }
}
