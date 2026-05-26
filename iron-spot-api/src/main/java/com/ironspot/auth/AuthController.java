package com.ironspot.auth;

import com.ironspot.auth.dto.NaverLoginRequest;
import com.ironspot.auth.dto.NaverLoginResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pre-authentication endpoints. Unlike {@code UserController} (which requires a
 * Supabase JWT), these run before the user has a session — see
 * {@code SecurityConfig} for the {@code permitAll} matcher. Per-IP flooding is
 * still gated by {@code GlobalRateLimitFilter}.
 */
@Tag(name = "auth")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final NaverLoginService naverLoginService;

    @Operation(summary = "Bridge a Naver OAuth code to a Supabase session token")
    @PostMapping(value = "/naver", produces = MediaType.APPLICATION_JSON_VALUE)
    public NaverLoginResponse naverLogin(@Valid @RequestBody NaverLoginRequest request) {
        return naverLoginService.login(request.code(), request.state());
    }
}
