package com.ironspot.gym;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.CreateGymRequest;
import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.gym.dto.NaverPlaceResult;
import com.ironspot.gym.dto.TemplateCountResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping(value = "/api/gyms", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Validated
public class GymController {

    private final GymService gymService;

    @GetMapping("/search")
    @Operation(summary = "Search gyms within map bounds", tags = {"gyms"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Gym list returned successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "400", description = "Missing or invalid bounds parameters",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public List<GymWithMachineCountResponse> search(
        @Valid @ModelAttribute @ParameterObject GymSearchRequest request
    ) {
        return gymService.searchInBounds(request);
    }

    @GetMapping("/template-counts")
    @Operation(summary = "Count gyms per machine template within map bounds", tags = {"gyms"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Per-template gym counts returned successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "400", description = "Missing or invalid bounds parameters",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public List<TemplateCountResponse> templateCounts(
        @Valid @ModelAttribute @ParameterObject GymSearchRequest request
    ) {
        return gymService.templateCountsInBounds(request);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get gym detail", tags = {"gyms"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Gym returned successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404", description = "Gym not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public GymDetailResponse getById(@PathVariable UUID id) {
        return gymService.findById(id)
            .orElseThrow(() -> new BusinessException("Gym not found: " + id, HttpStatus.NOT_FOUND));
    }

    @GetMapping("/places-search")
    @Operation(
        summary = "Search Naver 지역검색 for unregistered gyms",
        description = "Auth required (JWT). Naver quota guard — anonymous calls would drain it.",
        tags = {"gyms"}
    )
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Naver places list returned"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401", description = "Missing or invalid JWT"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "502", description = "Naver upstream failure",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public List<NaverPlaceResult> searchPlaces(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam @NotBlank @Size(max = 100) String query
    ) {
        return gymService.searchNaverPlaces(query, principal.getUserId());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
        summary = "Register a new gym from a Naver place",
        description = "Auth required. Idempotent on naverPlaceId — repeated calls return the same gym.",
        tags = {"gyms"}
    )
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Gym created or returned (dedup)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "400", description = "Validation error",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401", description = "Missing or invalid JWT")
    })
    public GymDetailResponse createGym(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody CreateGymRequest request
    ) {
        UUID creatorUserId = UUID.fromString(principal.getUserId());
        return gymService.createFromNaverPlaces(request, creatorUserId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
        summary = "Delete a user-registered gym (undo / cleanup path)",
        description = "Auth required. Allowed for the gym's original creator (V9 "
            + "created_by_user_id match) or admins. Refuses to delete a gym that "
            + "still has active gym_machines — other users' contributions take "
            + "precedence over the creator's undo right.",
        tags = {"gyms"}
    )
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "204", description = "Gym deleted"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401", description = "Missing or invalid JWT"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "403", description = "Caller is neither the creator nor an admin",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404", description = "Gym not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "409", description = "Gym has registered machines",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public void deleteGym(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        UUID callerUserId = UUID.fromString(principal.getUserId());
        boolean callerIsAdmin = principal.getAuthorities().stream()
            .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        gymService.deleteGym(id, callerUserId, callerIsAdmin);
    }
}
