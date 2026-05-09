package com.ironspot.photo;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.photo.dto.UpvoteResponse;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping(value = "/api/photos/{photoId}/upvote", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    @Operation(summary = "Upvote a photo", tags = {"votes"}, operationId = "upvotePhoto")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Upvoted (idempotent)"),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public UpvoteResponse upvote(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID photoId
    ) {
        return voteService.upvote(principal.getUserId(), photoId);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove upvote from a photo", tags = {"votes"}, operationId = "removeUpvotePhoto")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Removed (idempotent)"),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public void removeUpvote(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID photoId
    ) {
        voteService.removeUpvote(principal.getUserId(), photoId);
    }
}
