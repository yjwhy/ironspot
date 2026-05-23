package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Exactly one of {@code name} / {@code nameKo} should be populated by the
 * admin; the LLM fills the other side. Validation lives in the service to
 * keep this DTO a plain record (bean validation can't express "exactly one
 * of N fields" cleanly without polymorphism).
 */
public record TransliterateBrandRequest(
    @Schema(description = "English brand name. Provide this OR nameKo, not both.")
    String name,
    @Schema(description = "Korean brand name. Provide this OR name, not both.")
    String nameKo
) {}
