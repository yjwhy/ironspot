package com.ironspot.photo.dto;

import java.time.Instant;
import java.util.UUID;

public record PhotoResponse(
    UUID id,
    UUID gymMachineId,
    UUID userId,
    String photoUrl,
    int upvoteCount,
    Instant createdAt
) {}
