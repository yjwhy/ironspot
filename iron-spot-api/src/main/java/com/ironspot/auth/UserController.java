package com.ironspot.auth;

import com.ironspot.auth.dto.UpdateUserRequest;
import com.ironspot.auth.dto.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "users")
@SecurityRequirement(name = "Bearer")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "Get current user profile")
    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse getMe(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.getOrCreate(principal);
    }

    @Operation(summary = "Update current user nickname")
    @PutMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse updateMe(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody UpdateUserRequest request
    ) {
        return userService.updateNickname(principal.getUserId(), request.nickname());
    }

    @Operation(summary = "Delete current user account")
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal UserPrincipal principal) {
        userService.deleteAccount(principal.getUserId());
    }
}
