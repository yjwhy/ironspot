package com.ironspot.auth;

import com.ironspot.auth.dto.UserResponse;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

enum UserRowMapper implements RowMapper<UserResponse> {
    INSTANCE;

    @Override
    public UserResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        return UserResponse.builder()
            .id(rs.getString("id"))
            .email(rs.getString("email"))
            .nickname(rs.getString("nickname"))
            .createdAt(rs.getString("created_at"))
            .build();
    }
}
