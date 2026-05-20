package com.ironspot.machine.dto;

import com.ironspot.photo.dto.PhotoResponse;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Gym-instance machine row. Denormalises the brand + category + template
 * names (English) onto the response so the client doesn't need extra
 * round trips.
 *
 * <p>Phase 5 item 18: split the embedded template name into {@code
 * machineNameEn} (canonical English) + {@code machineNameKo} (Korean
 * primary used by card / list surfaces). The previous {@code machineName}
 * field was always English; the rename is symmetric with
 * {@link MachineTemplateResponse#nameEn()} / {@link
 * MachineTemplateResponse#nameKo()}.
 */
public record GymMachineResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int quantity,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean isCustom,
    String customName,
    Instant lastVerifiedAt,
    UUID templateId,
    String machineNameEn,
    String machineNameKo,
    String loadingType,
    UUID brandId,
    String brandName,
    UUID categoryId,
    String categoryName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PhotoResponse> photos
) {}
