package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record PhotoUploadResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID photoId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String photoUrl,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MachineTemplateSuggestion> suggestions,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "true if OCR text extraction succeeded and produced suggestions; false if OCR failed or produced no usable text") boolean ocrSucceeded
) {}
