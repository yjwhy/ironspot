package com.ironspot.machine.dto;

import com.ironspot.photo.dto.PhotoResponse;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

/**
 * Reference photos for a machine template (model), shown next to its name so
 * users can recognise equipment that looks alike but is named differently
 * across brands.
 *
 * <p>Resolution order the client renders: a curated official image first
 * ({@code officialImageUrl}), otherwise the ranked user photos, with
 * {@code officialUrl} offered as an external-browser fallback link. All three
 * may be absent for a template nobody has photographed yet ({@code hasAny}
 * is then false and the client shows a placeholder).
 */
public record TemplatePhotosResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID templateId,
    @Schema(description = "Public URL of the curated official product image, or null when none is curated.")
    String officialImageUrl,
    @Schema(description = "Manufacturer's official page for this model, opened in an external browser. Null when unknown.")
    String officialUrl,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "User-contributed photos, ranked owner-verified > upvotes > recency. May be empty.")
    List<PhotoResponse> userPhotos,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "True when any of officialImageUrl, officialUrl, or userPhotos is present.")
    boolean hasAny
) {}
