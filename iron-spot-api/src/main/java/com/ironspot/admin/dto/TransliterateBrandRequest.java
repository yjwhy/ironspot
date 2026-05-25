package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Exactly one of {@code name} / {@code nameKo} should be populated by the
 * admin; the LLM fills the other side. Validation lives in the service to
 * keep this DTO a plain record (bean validation can't express "exactly one
 * of N fields" cleanly without polymorphism).
 *
 * <p>Security task #43: {@code @Size(max=80)} on both sides caps the payload
 * that reaches the Gemini prompt. Without it an ADMIN account (or compromised
 * ADMIN session) could ship a multi-kilobyte string per call and burn the
 * Gemini free-tier daily quota in a few requests. Eighty characters covers
 * the longest plausible brand name (gym80, Booty Builder, 해머 스트렝스, ...) by
 * a wide margin.
 */
public record TransliterateBrandRequest(
    @Size(max = 80, message = "영문 브랜드명은 80자 이하여야 합니다")
    @Schema(description = "English brand name. Provide this OR nameKo, not both.")
    String name,
    @Size(max = 80, message = "한글 브랜드명은 80자 이하여야 합니다")
    @Schema(description = "Korean brand name. Provide this OR name, not both.")
    String nameKo
) {}
