package com.ironspot.gym.dto;

import java.time.Instant;
import java.util.UUID;

public record GymDetailResponse(
    UUID id,
    String name,
    String address,
    double latitude,
    double longitude,
    String phone,
    String operatingHours,
    Integer dayPassPrice,
    boolean isVerified,
    Instant lastVerifiedAt,
    Instant createdAt,
    Instant updatedAt
) {}
