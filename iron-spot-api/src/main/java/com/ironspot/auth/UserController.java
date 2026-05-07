package com.ironspot.auth;

import com.ironspot.auth.dto.UpdateUserRequest;
import com.ironspot.auth.dto.UserResponse;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Hidden
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public UserResponse getMe(@AuthenticationPrincipal UserPrincipal principal) {
        return userService.getOrCreate(principal);
    }

    @PutMapping("/me")
    public UserResponse updateMe(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody UpdateUserRequest request
    ) {
        return userService.updateNickname(principal.getUserId(), request.nickname());
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMe(@AuthenticationPrincipal UserPrincipal principal) {
        userService.deleteAccount(principal.getUserId());
    }
}
