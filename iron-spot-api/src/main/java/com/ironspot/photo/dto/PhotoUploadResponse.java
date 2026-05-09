package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record PhotoUploadResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID photoId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String photoUrl,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MachineTemplateSuggestion> suggestions,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean ocrSucceeded
) {}
