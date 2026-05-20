package com.ironspot.machine;

import com.ironspot.machine.dto.MachineTemplateResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Machine template catalog for filter UI + closed-list picker.
 *
 * <p>ADR 0022 / Task 45 introduced the endpoint; Phase 5 item 18 added the
 * optional {@code brandId} / {@code categoryId} query params so the picker's
 * TemplateStep can server-side filter instead of fetching the whole catalog
 * and narrowing in JS (slice 3 README follow-up).
 */
@RestController
@RequestMapping(value = "/api/machine-templates", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class MachineTemplateController {

    private final MachineTemplateRepository templateRepository;

    @GetMapping
    @Operation(summary = "List approved machine templates for filter UI + picker", tags = {"machine-templates"})
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Machine template list returned successfully")
    })
    public List<MachineTemplateResponse> listTemplates(
        @Parameter(description = "Restrict to templates of this brand.")
        @RequestParam(value = "brandId", required = false) UUID brandId,
        @Parameter(description = "Restrict to templates of this category (운동 부위).")
        @RequestParam(value = "categoryId", required = false) UUID categoryId
    ) {
        return templateRepository.findAllApprovedDetailed(brandId, categoryId);
    }
}
