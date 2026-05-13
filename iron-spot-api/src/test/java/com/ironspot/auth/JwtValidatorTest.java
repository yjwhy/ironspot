package com.ironspot.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class JwtValidatorTest {

    private static final String TEST_SECRET = "test-supabase-jwt-secret-for-testing-must-be-at-least-256-bits";
    private JwtValidator validator;
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        given(userRepository.findAuthContext(anyString())).willReturn(Optional.empty());
        validator = new JwtValidator(TEST_SECRET, userRepository);
    }

    private static final String TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

    @Test
    void validTokenReturnsPrincipalWithUserIdAndEmail() {
        String token = buildToken(TEST_USER_ID, "user@example.com", Date.from(Instant.now().plusSeconds(3600)));

        Optional<UserPrincipal> result = validator.validate(token);

        assertThat(result).isPresent();
        assertThat(result.get().getUserId()).isEqualTo(TEST_USER_ID);
        assertThat(result.get().getEmail()).isEqualTo("user@example.com");
    }

    @Test
    void expiredTokenReturnsEmpty() {
        String token = buildToken(TEST_USER_ID, "user@example.com", Date.from(Instant.now().minusSeconds(1)));

        assertThat(validator.validate(token)).isEmpty();
    }

    @Test
    void tokenSignedWithWrongKeyReturnsEmpty() {
        String wrongSecret = "wrong-secret-that-is-also-at-least-256-bits-long-for-hmac-sha256";
        SecretKey wrongKey = Keys.hmacShaKeyFor(wrongSecret.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
            .subject(TEST_USER_ID)
            .signWith(wrongKey)
            .compact();

        assertThat(validator.validate(token)).isEmpty();
    }

    @Test
    void malformedTokenReturnsEmpty() {
        assertThat(validator.validate("not.a.valid.jwt.token")).isEmpty();
    }

    @Test
    void tokenWithMissingEmailReturnsEmpty() {
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
            .subject("550e8400-e29b-41d4-a716-446655440000")
            .expiration(Date.from(Instant.now().plusSeconds(3600)))
            .signWith(key)
            .compact();

        assertThat(validator.validate(token)).isEmpty();
    }

    @Test
    void tokenWithNonUuidSubReturnsEmpty() {
        String token = buildToken("not-a-uuid", "user@example.com", Date.from(Instant.now().plusSeconds(3600)));

        assertThat(validator.validate(token)).isEmpty();
    }

    private String buildToken(String userId, String email, Date expiration) {
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
            .subject(userId)
            .claim("email", email)
            .expiration(expiration)
            .signWith(key)
            .compact();
    }
}
