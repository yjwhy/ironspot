package com.ironspot.auth;

import com.ironspot.auth.dto.NaverProfile;
import com.ironspot.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NaverOAuthClientTest {

    @Mock WebClient webClient;
    @SuppressWarnings("rawtypes")
    @Mock WebClient.RequestHeadersUriSpec uriSpec;
    @SuppressWarnings("rawtypes")
    @Mock WebClient.RequestHeadersSpec headersSpec;
    @Mock WebClient.ResponseSpec responseSpec;
    @SuppressWarnings("rawtypes")
    @Mock Mono<Map> monoResponse;

    NaverOAuthClient client;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setup() {
        client = new NaverOAuthClient(webClient);
        ReflectionTestUtils.setField(client, "clientId", "test-client-id");
        ReflectionTestUtils.setField(client, "clientSecret", "test-client-secret");
        when(webClient.get()).thenReturn(uriSpec);
        when(uriSpec.uri(any(URI.class))).thenReturn(headersSpec);
        when(headersSpec.headers(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(monoResponse);
    }

    @Test
    void exchangesCodeThenReturnsProfile() {
        // First block() = token endpoint, second = profile endpoint.
        when(monoResponse.block(any()))
            .thenReturn(Map.of("access_token", "naver-access-token", "token_type", "bearer"))
            .thenReturn(Map.of(
                "resultcode", "00",
                "message", "success",
                "response", Map.of(
                    "id", "naver-unique-123",
                    "email", "tester@naver.com",
                    "name", "테스터")));

        NaverProfile profile = client.exchangeCodeForProfile("auth-code", "state-xyz");

        assertThat(profile.id()).isEqualTo("naver-unique-123");
        assertThat(profile.email()).isEqualTo("tester@naver.com");
        assertThat(profile.name()).isEqualTo("테스터");
    }

    @Test
    void emailIsNullWhenScopeNotGranted() {
        // Naver omits email until the email scope passes 검수 — id always present.
        when(monoResponse.block(any()))
            .thenReturn(Map.of("access_token", "tok"))
            .thenReturn(Map.of(
                "resultcode", "00",
                "response", Map.of("id", "naver-unique-456", "name", "이름")));

        NaverProfile profile = client.exchangeCodeForProfile("code", "state");

        assertThat(profile.id()).isEqualTo("naver-unique-456");
        assertThat(profile.email()).isNull();
        assertThat(profile.name()).isEqualTo("이름");
    }

    @Test
    void throwsWhenTokenExchangeReturnsNoAccessToken() {
        when(monoResponse.block(any()))
            .thenReturn(Map.of("error", "invalid_request", "error_description", "bad code"));

        assertThatThrownBy(() -> client.exchangeCodeForProfile("bad-code", "state"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("네이버");
    }

    @Test
    void throwsWhenProfileFetchHasNoId() {
        when(monoResponse.block(any()))
            .thenReturn(Map.of("access_token", "tok"))
            .thenReturn(Map.of("resultcode", "024", "message", "Authentication failed"));

        assertThatThrownBy(() -> client.exchangeCodeForProfile("code", "state"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("네이버");
    }

    @Test
    void wrapsTransportFailureAsBusinessException() {
        when(monoResponse.block(any())).thenThrow(new RuntimeException("network down"));

        assertThatThrownBy(() -> client.exchangeCodeForProfile("code", "state"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("네이버");
    }
}
