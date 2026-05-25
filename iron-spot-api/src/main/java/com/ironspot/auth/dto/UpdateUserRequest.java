package com.ironspot.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Update payload for {@code PATCH /api/users/me}.
 *
 * <p>Security task #28: the {@code @Pattern} restricts the nickname to
 * Korean (완성형 + 자음/모음 단독), Latin letters, digits, space, underscore,
 * and hyphen. This blocks bidi override (U+202E), zero-width joiner /
 * space, control characters, and homoglyph attacks (Cyrillic 'а' vs Latin
 * 'a') that could be used to impersonate {@code admin} or another user
 * in the dashboard / Slack moderation channel.
 */
public record UpdateUserRequest(
    @NotBlank(message = "닉네임을 입력해주세요")
    @Size(min = 2, max = 20, message = "닉네임은 2~20자여야 합니다")
    @Pattern(
        regexp = "^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 _\\-]+$",
        message = "닉네임은 한글, 영문, 숫자, 공백, _, - 만 사용할 수 있어요"
    )
    String nickname
) {}
