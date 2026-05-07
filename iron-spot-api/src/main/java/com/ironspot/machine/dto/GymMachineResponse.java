package com.ironspot.machine.dto;

import java.time.Instant;
import java.util.UUID;

public record GymMachineResponse(
    UUID id,
    int quantity,
    boolean isCustom,
    String customName,
    Instant lastVerifiedAt,
    UUID templateId,
    String machineName,
    String loadingType,
    UUID brandId,
    String brandName,
    UUID categoryId,
    String categoryName,
    long photoCount
) {}
