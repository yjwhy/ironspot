package com.ironspot.owner;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.owner.dto.OwnerClaimResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/owner", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class OwnerController {

    private static final int MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

    private final OwnerService ownerService;

    /**
     * Submit a 사업자등록증 photo to claim ownership of a gym (Task 47 / ADR 0023 Q1 U).
     *
     * <p>Image bytes are processed in-memory (OCR + 국세청 진위확인) and discarded —
     * never written to disk or storage. Caller must include {@code consent=true}
     * per PIPA requirement (collection-time consent).
     */
    @PostMapping(value = "/claim", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Claim processed (status field carries verdict)"),
        @ApiResponse(responseCode = "400", description = "Invalid file or missing consent",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @Operation(summary = "Claim ownership of a gym via 사업자등록증 OCR", tags = {"owner"})
    public OwnerClaimResponse claim(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam("image") MultipartFile image,
        @RequestParam("gymId") UUID gymId,
        @RequestParam(value = "consent", defaultValue = "false") boolean consent
    ) {
        if (image.isEmpty()) {
            throw new BusinessException("사업자등록증 사진을 첨부해 주세요.", HttpStatus.BAD_REQUEST);
        }
        if (image.getSize() > MAX_UPLOAD_BYTES) {
            throw new BusinessException("사진 크기는 2MB 이하여야 해요.", HttpStatus.BAD_REQUEST);
        }
        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException ex) {
            throw new BusinessException("사진을 읽을 수 없어요. 다시 시도해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return ownerService.claim(UUID.fromString(principal.getUserId()), gymId, bytes, consent);
    }
}
