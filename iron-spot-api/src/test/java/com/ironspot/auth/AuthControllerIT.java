package com.ironspot.auth;

import com.ironspot.auth.dto.NaverProfile;
import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.net.URI;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Verifies the Naver-login bridge endpoint is reachable WITHOUT a Supabase JWT
 * (permitAll — the caller has no session yet) and that it bubbles the minted
 * token hash. The two outbound clients are mocked so no Naver / Supabase
 * network call happens; their transport is verified live once creds are set.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AuthControllerIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;

    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private NaverOAuthClient naverOAuthClient;
    @MockitoBean private SupabaseAuthAdminClient supabaseAuthAdminClient;

    @Test
    void naverLoginIsReachableAnonymouslyAndReturnsTokenHash() {
        // Account is keyed on the synthetic naver_<id> email, never the real one.
        String syntheticEmail = "naver_nid-it@users.ironspot.app";
        when(naverOAuthClient.exchangeCodeForProfile("auth-code", "state-1"))
            .thenReturn(new NaverProfile("nid-it", "it@naver.com", "통합테스트"));
        when(supabaseAuthAdminClient.generateMagicLinkTokenHash(syntheticEmail))
            .thenReturn("it-token-hash");

        ResponseEntity<String> response = restTemplate.exchange(
            RequestEntity.post(URI.create("/api/auth/naver"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("code", "auth-code", "state", "state-1")),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains("\"tokenHash\":\"it-token-hash\"")
            .contains("\"email\":\"naver_nid-it@users.ironspot.app\"")
            .contains("\"type\":\"magiclink\"");
    }

    @Test
    void naverLoginRejectsBlankCodeWith400() {
        ResponseEntity<String> response = restTemplate.exchange(
            RequestEntity.post(URI.create("/api/auth/naver"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("code", "", "state", "state-1")),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
