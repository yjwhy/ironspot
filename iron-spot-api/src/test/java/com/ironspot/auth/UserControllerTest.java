package com.ironspot.auth;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class UserControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    @Test
    void getMeReturns401WithoutToken() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/users/me", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMeReturns401WithInvalidToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("not-a-real-jwt");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.GET, entity, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMeCreatesAndReturnsUserOnFirstVisit() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
                .email("test@example.com")
                .build()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains("test@example.com")
            .contains("\"role\":\"user\"");
    }

    @Test
    void getMeReturnsExistingUserOnSubsequentVisit() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("b2c3d4e5-f6a7-8901-bcde-f12345678901")
                .email("existing@example.com")
                .build()));

        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);
        ResponseEntity<String> secondResponse = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        assertThat(secondResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(secondResponse.getBody()).contains("existing@example.com");
    }

    @Test
    void updateMeReturns200WithValidNickname() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("c3d4e5f6-a7b8-9012-cdef-123456789012")
                .email("update@example.com")
                .build()));

        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> body = new HttpEntity<>("{\"nickname\":\"새닉네임\"}", headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.PUT, body, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("새닉네임");
    }

    @Test
    void updateMeReturns400WithBlankNickname() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("d4e5f6a7-b8c9-0123-defa-234567890123")
                .email("valid@example.com")
                .build()));

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> body = new HttpEntity<>("{\"nickname\":\"\"}", headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.PUT, body, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void deleteMeReturns204() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("e5f6a7b8-c9d0-1234-efab-345678901234")
                .email("delete@example.com")
                .build()));

        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.DELETE, bearerRequest(null), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    private HttpEntity<Void> bearerRequest(HttpHeaders extra) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        if (extra != null) extra.forEach(headers::addAll);
        return new HttpEntity<>(headers);
    }
}
