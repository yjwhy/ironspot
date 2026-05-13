package com.ironspot.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record DispositionRequest(
    @NotBlank
    @Pattern(regexp = "actioned|dismissed", message = "disposition must be 'actioned' or 'dismissed'")
    String disposition
) {
}
