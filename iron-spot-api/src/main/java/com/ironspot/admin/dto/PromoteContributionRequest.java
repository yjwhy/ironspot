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
 *       promotes the pending row to it. {@code categoryId} is optional.</li>
 *   <li>{@code newBrandAndTemplate} — requires {@code newBrandName,
 *       newBrandNameKo, nameEn, nameKo, loadingType}. Authors a new brand
 *       AND a new template under it (used when the brand catalog itself is
 *       short a row). {@code newBrandNameKo} (Phase 5 item 24) is required
 *       because V11 made {@code brands.name_ko} NOT NULL. {@code
 *       categoryId} is optional.</li>
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
    UUID categoryId
) {
}
