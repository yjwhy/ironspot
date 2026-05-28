package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Admin promote action for a pending machine contribution. Phase 5 item 11
 * sub-task 4. {@code kind} dispatches between three flows; the service layer
 * validates that the right fields are present for the chosen kind and emits
 * a 400 otherwise.
 *
 * <ul>
 *   <li>{@code existingTemplate} — requires {@code templateId}. Maps the
 *       pending row to an already-approved template. If the same gym already
 *       has an approved row for that template, the pending row's quantity is
 *       merged into the existing row.</li>
 *   <li>{@code newTemplate} — requires {@code brandId, nameEn, nameKo,
 *       loadingType}. Authors a new template under an existing brand and
 *       promotes the pending row to it. {@code categoryId} is optional.
 *       V27: optional {@code seriesId} attaches to an existing series under
 *       that brand, OR {@code newSeriesName} creates a new series first.
 *       Both null leaves the template's seriesId NULL.</li>
 *   <li>{@code newBrandAndTemplate} — requires {@code newBrandName,
 *       newBrandNameKo, nameEn, nameKo, loadingType}. Authors a new brand
 *       AND a new template under it (used when the brand catalog itself is
 *       short a row). {@code newBrandNameKo} (Phase 5 item 24) is required
 *       because V11 made {@code brands.name_ko} NOT NULL. {@code
 *       categoryId} is optional. V27: optional {@code newSeriesName}
 *       creates a series under the new brand and attaches the template
 *       to it. {@code seriesId} is rejected here — you cannot reference
 *       an existing series under a brand-new brand.</li>
 * </ul>
 *
 * <p>The flat-record shape (rather than a sealed-interface discriminated
 * union) is intentional: Jackson + Springdoc renders a sealed parent as an
 * {@code allOf}-inheriting child schema, producing a self-referential
 * TypeScript type via Orval. Validation moves to the service layer in
 * exchange for a clean OpenAPI schema.
 */
public record PromoteContributionRequest(
    @NotBlank
    @Pattern(
        regexp = "existingTemplate|newTemplate|newBrandAndTemplate",
        message = "kind must be 'existingTemplate', 'newTemplate', or 'newBrandAndTemplate'"
    )
    @Schema(
        requiredMode = Schema.RequiredMode.REQUIRED,
        allowableValues = {"existingTemplate", "newTemplate", "newBrandAndTemplate"}
    )
    String kind,

    @Schema(description = "Required when kind='existingTemplate'")
    UUID templateId,

    @Schema(description = "Required when kind='newTemplate'")
    UUID brandId,

    @Size(max = 80)
    @Schema(description = "Required when kind='newBrandAndTemplate'. Canonical English brand identifier.")
    String newBrandName,

    @Size(max = 80)
    @Schema(description = "Required when kind='newBrandAndTemplate'. Korean display label for the brand (Phase 5 item 24).")
    String newBrandNameKo,

    @Size(max = 120)
    @Schema(description = "Required when kind='newTemplate' or 'newBrandAndTemplate'")
    String nameEn,

    @Size(max = 120)
    @Schema(description = "Required when kind='newTemplate' or 'newBrandAndTemplate'")
    String nameKo,

    @Pattern(regexp = "pin|plate", message = "loadingType must be 'pin' or 'plate'")
    @Schema(
        description = "Required when kind='newTemplate' or 'newBrandAndTemplate'",
        allowableValues = {"pin", "plate"}
    )
    String loadingType,

    @Schema(description = "Optional categories.id; null leaves the template uncategorised")
    UUID categoryId,

    @Schema(description = "V27: optional existing machine_series.id under brandId. Only valid when kind='newTemplate'. Mutually exclusive with newSeriesName.")
    UUID seriesId,

    @Size(max = 80)
    @Schema(description = "V27: optional new series name to create under brandId (newTemplate) or newBrandName (newBrandAndTemplate). Mutually exclusive with seriesId.")
    String newSeriesName
) {
    /**
     * Backwards-compatible 9-arg constructor used by pre-V27 unit tests.
     * Defaults the new series fields to null so existing fixtures compile
     * unchanged. Wire requests via Jackson use the canonical 11-arg form.
     */
    public PromoteContributionRequest(
        String kind,
        UUID templateId,
        UUID brandId,
        String newBrandName,
        String newBrandNameKo,
        String nameEn,
        String nameKo,
        String loadingType,
        UUID categoryId
    ) {
        this(kind, templateId, brandId, newBrandName, newBrandNameKo,
            nameEn, nameKo, loadingType, categoryId, null, null);
    }
}
