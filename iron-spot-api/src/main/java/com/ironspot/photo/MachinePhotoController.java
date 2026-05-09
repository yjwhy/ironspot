package com.ironspot.photo;

import com.ironspot.photo.dto.PhotoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/machines", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class MachinePhotoController {

    private final PhotoService photoService;

    @GetMapping("/{gymMachineId}/photos")
    @Operation(summary = "List photos for a gym machine", tags = {"photos"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Photo list returned successfully")
    })
    public List<PhotoResponse> listPhotos(@PathVariable UUID gymMachineId) {
        return photoService.findByGymMachineId(gymMachineId);
    }
}
