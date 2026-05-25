package com.ironspot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record NlSearchRequest(
    @NotBlank
    @Size(max = 200)
    /*
     * Security task #70: reject control / format characters (NUL, BEL, LF,
     * CR, TAB, U+200B-U+200D, U+202E RTL override, U+FEFF BOM). \p{C}
     * covers Cc / Cf / Cs / Co / Cn. Without this guard a prompt-injected
     * query could embed pseudo-XML role markers separated by \n, or zero-
     * width joiners that defeat string-equality based jailbreak detection.
     * Plain space (U+0020) is preserved — Korean NL queries need it.
     */
    @Pattern(regexp = "^[^\\p{C}]+$", message = "검색어에 사용할 수 없는 문자가 포함되어 있어요")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Korean natural language gym search query")
    String query,

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    Double userLat,

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    Double userLng
) {}
