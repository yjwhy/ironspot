package com.ironspot.machine;

import com.ironspot.machine.dto.MachineTemplateResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Machine template catalog for filter UI. ADR 0022 / Task 45.
 */
@RestController
@RequestMapping(value = "/api/machine-templates", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class MachineTemplateController {

    private final MachineTemplateRepository templateRepository;

    @GetMapping
    @Operation(summary = "List approved machine templates for filter UI", tags = {"machine-templates"})
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Machine template list returned successfully")
    })
    public List<MachineTemplateResponse> listTemplates() {
        return templateRepository.findAllApprovedDetailed();
    }
}
