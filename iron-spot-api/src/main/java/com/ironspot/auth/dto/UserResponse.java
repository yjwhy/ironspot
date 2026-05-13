package com.ironspot.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserResponse {
    private String id;
    private String email;
    private String nickname;
    private String createdAt;

    @Schema(allowableValues = {"user", "admin", "owner"})
    private String role;
}
