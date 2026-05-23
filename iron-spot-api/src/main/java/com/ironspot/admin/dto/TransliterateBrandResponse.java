package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Both sides populated: the admin's input echoed verbatim plus the LLM's
 * suggested translation for the other field. Admin reviews and may edit
 * either before submitting the brand promote request.
 */
public record TransliterateBrandResponse(
    @Schema(description = "English brand name (admin's input echoed if they typed EN, LLM's suggestion otherwise).")
    String name,
    @Schema(description = "Korean brand name (admin's input echoed if they typed KO, LLM's suggestion otherwise).")
    String nameKo
) {}
