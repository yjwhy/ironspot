package com.ironspot.admin;

import com.ironspot.admin.dto.TransliterateBrandRequest;
import com.ironspot.admin.dto.TransliterateBrandResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only LLM-backed transliterate helper for the new-brand promote
 * flow. The admin types one of EN / KO in the "새 브랜드" tab and hits
 * "AI 제안"; this endpoint fills the other side from the locked launch
 * mapping or general 한글 transliteration conventions.
 */
@RestController
@RequestMapping(value = "/api/admin", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminBrandTransliterateController {

    private final AdminBrandTransliterateService service;

    @PostMapping(value = "/transliterate-brand", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
        summary = "Suggest the missing language side of a brand name via LLM",
        tags = {"admin"}
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Both fields populated"),
        @ApiResponse(responseCode = "400", description = "Must provide exactly one of name / nameKo"),
        @ApiResponse(responseCode = "502", description = "LLM upstream error"),
        @ApiResponse(responseCode = "503", description = "Gemini API key not configured")
    })
    public TransliterateBrandResponse transliterate(
        @Valid @RequestBody TransliterateBrandRequest request
    ) {
        // Security A7: @Valid forces the DTO's @Size(max=80) on each name
        // field to fire at the controller boundary rather than after the
        // service's sanitiseInputString. A 10 MB payload now 400s before
        // reaching Gemini or the rate cap.
        return service.transliterate(request);
    }
}
