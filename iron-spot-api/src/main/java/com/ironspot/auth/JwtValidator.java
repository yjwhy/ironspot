package com.ironspot.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

@Component
@Slf4j
public class JwtValidator {

    private final SecretKey signingKey;
    private final UserRepository userRepository;

    public JwtValidator(
        @Value("${security.supabase-jwt-secret}") String jwtSecret,
        UserRepository userRepository
    ) {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                "SUPABASE_JWT_SECRET must be at least 32 bytes (256 bits) for HS256");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.userRepository = userRepository;
    }

    public Optional<UserPrincipal> validate(String token) {
        try {
            Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

            String sub = claims.getSubject();
            try {
                UUID.fromString(sub);
            } catch (IllegalArgumentException e) {
                log.debug("JWT sub is not a UUID: {}", sub);
                return Optional.empty();
            }

            String email = claims.get("email", String.class);
            if (email == null || email.isBlank()) {
                log.debug("JWT missing email claim for sub={}", sub);
                return Optional.empty();
            }

            UserAuthContext ctx = userRepository.findAuthContext(sub)
                .orElse(new UserAuthContext("user", null));

            return Optional.of(UserPrincipal.builder()
                .userId(sub)
                .email(email)
                .role(ctx.role())
                .bannedAt(ctx.bannedAt())
                .build());
        } catch (JwtException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
