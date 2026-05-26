package com.ironspot.owner;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BusinessRegistryClientTest {

    @Mock WebClient webClient;
    @Mock WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock WebClient.RequestBodySpec requestBodySpec;
    @Mock WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock WebClient.ResponseSpec responseSpec;
    @SuppressWarnings("rawtypes")
    @Mock Mono<Map> monoResponse;

    @InjectMocks BusinessRegistryClient client;

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(client, "baseUrl", "https://api.example.test");
        ReflectionTestUtils.setField(client, "apiKey", "test-key");
    }

    private void mockHttpChain() {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        // Security B6: serviceKey now sent via Authorization header, not the
        // URL query string. The header call lives between uri() and
        // contentType() in the WebClient builder chain.
        when(requestBodySpec.header(anyString(), anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(monoResponse);
    }

    @Test
    void validateReturnsTrueOnValidFlag01() {
        mockHttpChain();
        when(monoResponse.block(any())).thenReturn(Map.of(
            "match_cnt", 1,
            "data", List.of(Map.of("b_no", "1234567890", "valid", "01", "valid_msg", "확인된 사업자"))));

        boolean ok = client.validate("1234567890", "20200101", "홍길동", "분당짐");
        assertThat(ok).isTrue();
    }

    @Test
    void validateReturnsFalseOnNonValidFlag() {
        mockHttpChain();
        when(monoResponse.block(any())).thenReturn(Map.of(
            "match_cnt", 0,
            "data", List.of(Map.of("b_no", "1234567890", "valid", "02", "valid_msg", "확인할 수 없는 사업자"))));

        boolean ok = client.validate("1234567890", "20200101", "홍길동", "분당짐");
        assertThat(ok).isFalse();
    }

    @Test
    void validateReturnsFalseOnEmptyData() {
        mockHttpChain();
        when(monoResponse.block(any())).thenReturn(Map.of("data", List.of()));

        boolean ok = client.validate("1234567890", "20200101", "홍길동", "분당짐");
        assertThat(ok).isFalse();
    }

    @Test
    void validateReturnsFalseOnApiKeyMissing() {
        ReflectionTestUtils.setField(client, "apiKey", "");
        boolean ok = client.validate("1234567890", "20200101", "홍길동", "분당짐");
        assertThat(ok).isFalse();
    }

    @Test
    void validateReturnsFalseOnNetworkException() {
        mockHttpChain();
        when(monoResponse.block(any())).thenThrow(new RuntimeException("connect timeout"));

        boolean ok = client.validate("1234567890", "20200101", "홍길동", "분당짐");
        assertThat(ok).isFalse();
    }

    @Test
    void validateReturnsFalseOnBlankBusinessNumber() {
        boolean ok = client.validate("", "20200101", "홍길동", "분당짐");
        assertThat(ok).isFalse();
    }
}
