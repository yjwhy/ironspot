package com.ironspot.series;

import com.ironspot.series.dto.SeriesResponse;
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
 * V27 / machine_series: powers the unified brand-or-series picker entry on
 * the manual-input flow. Returns the full catalog so the client can fuzzy-
 * merge brands + series in one offline-narrowing list.
 */
@RestController
@RequestMapping(value = "/api/series", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SeriesController {

    private final SeriesService seriesService;

    @GetMapping
    @Operation(summary = "List all brand product-line series", tags = {"series"})
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Series list returned successfully")
    })
    public List<SeriesResponse> listSeries() {
        return seriesService.listAll();
    }
}
