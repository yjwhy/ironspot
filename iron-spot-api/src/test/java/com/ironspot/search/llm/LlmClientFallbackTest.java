package com.ironspot.search.llm;

import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.SearchDsl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Unit-level fallback semantics for {@link FallbackLlmClient}.
 * No HTTP — both primary and fallback are Mockito mocks of {@link LlmClient}.
 *
 * <p>Transient failures (RATE_LIMIT / TIMEOUT / TRANSPORT) route to the fallback;
 * INVALID_RESPONSE propagates because the fallback won't fix a malformed prompt.
 */
class LlmClientFallbackTest {

    private static final String QUERY = "강남역 근처 헬스장";
    private static final SearchDsl VALID_DSL =
        new SearchDsl(new Location.Current(1.0), List.of(), null);

    private LlmClient primary;
    private LlmClient fallback;
    private FallbackLlmClient composite;

    @BeforeEach
    void setUp() {
        primary = mock(LlmClient.class);
        fallback = mock(LlmClient.class);
        composite = new FallbackLlmClient(primary, fallback);
    }

    @Test
    void primarySuccessReturnsPrimaryResultWithoutCallingFallback() {
        given(primary.parse(QUERY)).willReturn(VALID_DSL);

        SearchDsl result = composite.parse(QUERY);

        assertThat(result).isEqualTo(VALID_DSL);
        verify(fallback, never()).parse(any());
    }

    @Test
    void primaryRateLimitFallsBackToSecondary() {
        given(primary.parse(anyString())).willThrow(new LlmException(LlmException.Kind.RATE_LIMIT, "429"));
        given(fallback.parse(QUERY)).willReturn(VALID_DSL);

        SearchDsl result = composite.parse(QUERY);

        assertThat(result).isEqualTo(VALID_DSL);
        verify(fallback).parse(QUERY);
    }

    @Test
    void primaryTimeoutFallsBackToSecondary() {
        given(primary.parse(anyString())).willThrow(new LlmException(LlmException.Kind.TIMEOUT, "timed out"));
        given(fallback.parse(QUERY)).willReturn(VALID_DSL);

        SearchDsl result = composite.parse(QUERY);

        assertThat(result).isEqualTo(VALID_DSL);
        verify(fallback).parse(QUERY);
    }

    @Test
    void primaryTransportFallsBackToSecondary() {
        given(primary.parse(anyString())).willThrow(new LlmException(LlmException.Kind.TRANSPORT, "connection reset"));
        given(fallback.parse(QUERY)).willReturn(VALID_DSL);

        SearchDsl result = composite.parse(QUERY);

        assertThat(result).isEqualTo(VALID_DSL);
        verify(fallback).parse(QUERY);
    }

    @Test
    void primaryInvalidResponseDoesNotFallBack() {
        given(primary.parse(anyString()))
            .willThrow(new LlmException(LlmException.Kind.INVALID_RESPONSE, "malformed json"));

        assertThatThrownBy(() -> composite.parse(QUERY))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
        verify(fallback, never()).parse(any());
    }

    @Test
    void bothFailPropagatesFallbackException() {
        given(primary.parse(anyString())).willThrow(new LlmException(LlmException.Kind.RATE_LIMIT, "primary 429"));
        given(fallback.parse(anyString())).willThrow(new LlmException(LlmException.Kind.TRANSPORT, "fallback connect refused"));

        assertThatThrownBy(() -> composite.parse(QUERY))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.TRANSPORT);
    }
}
