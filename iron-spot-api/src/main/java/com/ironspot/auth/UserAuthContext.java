package com.ironspot.auth;

import java.time.OffsetDateTime;

public record UserAuthContext(String role, OffsetDateTime bannedAt) {
}
