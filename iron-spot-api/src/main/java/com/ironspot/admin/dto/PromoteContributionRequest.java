package com.ironspot.admin.dto;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Admin promote action for a pending machine contribution. Phase 5 item 11
 * sub-task 4. Three kinds dispatch on the {@code kind} discriminator:
 * <ul>
 *   <li>{@code existingTemplate} — map the pending row to an already-approved
 *       template. If the gym already has an approved row for that template,
 *       the pending row's quantity is merged into the existing row and the
 *       pending row is soft-deleted.</li>
 *   <li>{@code newTemplate} — admin authors a new template under an existing
 *       brand and promotes the pending row to point at it.</li>
 *   <li>{@code newBrandAndTemplate} — admin authors a new brand AND a new
 *       template under it (used when the brand catalog itself is short a row).</li>
 * </ul>
 * <p>
 * The closed-list autocomplete pattern (2026-05-20 decision) means LLMs cannot
 * synthesise brand/template names; this endpoint is the human escape hatch
 * that keeps the catalog growing without violating that constraint.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = PromoteContributionRequest.ExistingTemplate.class, name = "existingTemplate"),
    @JsonSubTypes.Type(value = PromoteContributionRequest.NewTemplate.class, name = "newTemplate"),
    @JsonSubTypes.Type(value = PromoteContributionRequest.NewBrandAndTemplate.class, name = "newBrandAndTemplate")
})
@Schema(
    description = "Promote action discriminated on `kind`",
    oneOf = {
        PromoteContributionRequest.ExistingTemplate.class,
        PromoteContributionRequest.NewTemplate.class,
        PromoteContributionRequest.NewBrandAndTemplate.class
    }
)
public sealed interface PromoteContributionRequest
    permits PromoteContributionRequest.ExistingTemplate,
            PromoteContributionRequest.NewTemplate,
            PromoteContributionRequest.NewBrandAndTemplate {

    @Schema(description = "Promote to an existing approved machine_template")
    record ExistingTemplate(
        @NotNull
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        UUID templateId
    ) implements PromoteContributionRequest {}

    @Schema(description = "Create a new machine_template under an existing brand, then promote")
    record NewTemplate(
        @NotNull
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        UUID brandId,

        @NotBlank
        @Size(max = 120)
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String nameEn,

        @NotBlank
        @Size(max = 120)
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String nameKo,

        @NotBlank
        @Pattern(regexp = "pin|plate", message = "loadingType must be 'pin' or 'plate'")
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"pin", "plate"})
        String loadingType,

        @Schema(description = "Optional categories.id; null leaves the template uncategorised")
        UUID categoryId
    ) implements PromoteContributionRequest {}

    @Schema(description = "Create a new brand AND a new template under it, then promote")
    record NewBrandAndTemplate(
        @NotNull
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        NewBrandPayload brand,

        @NotNull
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        NewTemplatePayload template
    ) implements PromoteContributionRequest {}

    record NewBrandPayload(
        @NotBlank
        @Size(max = 80)
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String name
    ) {}

    record NewTemplatePayload(
        @NotBlank
        @Size(max = 120)
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String nameEn,

        @NotBlank
        @Size(max = 120)
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String nameKo,

        @NotBlank
        @Pattern(regexp = "pin|plate", message = "loadingType must be 'pin' or 'plate'")
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"pin", "plate"})
        String loadingType,

        @Schema(description = "Optional categories.id; null leaves the template uncategorised")
        UUID categoryId
    ) {}
}
