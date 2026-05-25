package com.ironspot.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

/**
 * Drives JwtValidator's lift logic (sub → UserPrincipal) with a mocked
 * {@link JwtDecoder}. Crypto verification (signature, exp, iss) is Nimbus's
 * responsibility and is exercised end-to-end through AdminControllerIT /
 * UserControllerTest, which {@code @MockitoBean} JwtValidator and don't need
 * real tokens. The aud claim is enforced here at the application layer.
 */
class JwtValidatorTest {

    private static final String TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final List<String> AUTHENTICATED = List.of("authenticated");

    private JwtDecoder decoder;
    private UserRepository userRepository;
    private JwtValidator validator;

    @BeforeEach
    void setUp() {
        decoder = mock(JwtDecoder.class);
        userRepository = mock(UserRepository.class);
        given(userRepository.findAuthContext(anyString())).willReturn(Optional.empty());
        validator = new JwtValidator(decoder, userRepository);
    }

    @Test
    void validTokenReturnsPrincipalWithUserIdAndEmail() {
        given(decoder.decode(anyString())).willReturn(buildJwt(TEST_USER_ID, "user@example.com"));

        Optional<UserPrincipal> result = validator.validate("valid.token");

        assertThat(result).isPresent();
        assertThat(result.get().getUserId()).isEqualTo(TEST_USER_ID);
        assertThat(result.get().getEmail()).isEqualTo("user@example.com");
    }

    @Test
    void principalCarriesRoleAndBannedAtFromUserRepository() {
        OffsetDateTime bannedAt = OffsetDateTime.of(2026, 5, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        given(decoder.decode(anyString())).willReturn(buildJwt(TEST_USER_ID, "u@x.com"));
        given(userRepository.findAuthContext(TEST_USER_ID))
            .willReturn(Optional.of(new UserAuthContext("admin", bannedAt)));

        Optional<UserPrincipal> result = validator.validate("valid.token");

        assertThat(result).isPresent();
        assertThat(result.get().getRole()).isEqualTo("admin");
        assertThat(result.get().isBanned()).isTrue();
    }

    @Test
    void decoderExceptionReturnsEmpty() {
        given(decoder.decode(anyString())).willThrow(new BadJwtException("signature mismatch"));

        assertThat(validator.validate("bad.token")).isEmpty();
    }

    @Test
    void tokenWithMissingEmailReturnsEmpty() {
        given(decoder.decode(anyString())).willReturn(buildJwt(TEST_USER_ID, null));

        assertThat(validator.validate("token")).isEmpty();
    }

    @Test
    void tokenWithBlankEmailReturnsEmpty() {
        given(decoder.decode(anyString())).willReturn(buildJwt(TEST_USER_ID, ""));

        assertThat(validator.validate("token")).isEmpty();
    }

    @Test
    void tokenWithNonUuidSubReturnsEmpty() {
        given(decoder.decode(anyString())).willReturn(buildJwt("not-a-uuid", "user@example.com"));

        assertThat(validator.validate("token")).isEmpty();
    }

    @Test
    void tokenWithMissingAudienceReturnsEmpty() {
        given(decoder.decode(anyString()))
            .willReturn(buildJwt(TEST_USER_ID, "u@x.com", null));

        assertThat(validator.validate("token")).isEmpty();
    }

    @Test
    void tokenWithWrongAudienceReturnsEmpty() {
        given(decoder.decode(anyString()))
            .willReturn(buildJwt(TEST_USER_ID, "u@x.com", List.of("service_role")));

        assertThat(validator.validate("token")).isEmpty();
    }

    @Test
    void tokenWithAuthenticatedAndExtraAudiencesIsAccepted() {
        given(decoder.decode(anyString()))
            .willReturn(buildJwt(TEST_USER_ID, "u@x.com",
                List.of("authenticated", "https://other.example")));

        assertThat(validator.validate("token")).isPresent();
    }

    private static Jwt buildJwt(String sub, String email) {
        return buildJwt(sub, email, AUTHENTICATED);
    }

    private static Jwt buildJwt(String sub, String email, List<String> audiences) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", sub);
        if (email != null) claims.put("email", email);
        if (audiences != null) claims.put("aud", audiences);
        return new Jwt(
            "header.payload.signature",
            Instant.now(),
            Instant.now().plusSeconds(3600),
            Map.of("alg", "ES256"),
            claims
        );
    }
}
