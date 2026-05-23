package com.ironspot.photo;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.photo.dto.OcrOnlyResponse;
import com.ironspot.photo.dto.PhotoUploadResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
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
        @ApiResponse(responseCode = "400", description = "Invalid file",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public PhotoUploadResponse upload(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam("image") MultipartFile image,
        // Phase 5 item 11 slice 2: gymMachineId is optional. When omitted the
        // photo lands as an orphan (machine_photos.gym_machine_id = NULL) and
        // the OCR confirm screen's POST /api/gym-machines binds it via the
        // bindOrphanGymMachineId NULL-guard. Bound uploads (machine photo
        // gallery, owner workflow) keep passing the id.
        @RequestParam(value = "gymMachineId", required = false) UUID gymMachineId
    ) {
        return photoService.upload(principal.getUserId(), image, gymMachineId);
    }

    @PostMapping(value = "/ocr-only", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.OK)
    @Operation(
        summary = "Analyse a label photo for OCR suggestions without storing it",
        tags = {"photos"},
        description = "Two-photo capture flow: the label image is used only "
            + "for Vision OCR + brand-anchored matching, then discarded. "
            + "The caller then captures the whole-machine photo and posts "
            + "it through the regular /api/photos/upload endpoint."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "OCR suggestions returned"),
        @ApiResponse(responseCode = "400", description = "Invalid file or content rejected by SafeSearch / PII",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Per-user Vision quota exceeded",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public OcrOnlyResponse analyzeForOcrOnly(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam("image") MultipartFile image
    ) {
        return photoService.analyzeForOcrOnly(principal.getUserId(), image);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete own photo", tags = {"photos"}, operationId = "deletePhoto")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Deleted"),
        @ApiResponse(responseCode = "403", description = "Not owner",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public void delete(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        photoService.deleteOwn(principal.getUserId(), id);
    }
}
