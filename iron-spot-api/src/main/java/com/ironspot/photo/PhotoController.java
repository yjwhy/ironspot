package com.ironspot.photo;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.photo.dto.PhotoUploadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping(value = "/api/photos", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class PhotoController {

    private final PhotoService photoService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Upload a machine photo", tags = {"photos"})
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Photo uploaded successfully"),
        @ApiResponse(responseCode = "400", description = "Invalid file"),
        @ApiResponse(responseCode = "401", description = "Unauthenticated")
    })
    public PhotoUploadResponse upload(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam("image") MultipartFile image,
        @RequestParam("gymMachineId") UUID gymMachineId
    ) {
        return photoService.upload(principal.getUserId(), image, gymMachineId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete own photo", tags = {"photos"})
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Deleted"),
        @ApiResponse(responseCode = "403", description = "Not owner"),
        @ApiResponse(responseCode = "404", description = "Not found")
    })
    public void delete(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        photoService.deleteOwn(principal.getUserId(), id);
    }
}
