package com.ironspot.search;

import io.sentry.ScopeCallback;
import io.sentry.Sentry;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.time.Clock;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

class NlSearchEmptyResultReporterTest {

    private static final long MIN = 60_000L;

    @Test
    void emptyResultCapturesOnce() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1_000L);
        NlSearchEmptyResultReporter reporter = new NlSearchEmptyResultReporter(clock);

        try (MockedStatic<Sentry> sentry = mockStatic(Sentry.class)) {
            reporter.reportIfEmpty("강남역 파나타", 0);

            sentry.verify(
                () -> Sentry.captureMessage(eq("nl_search_empty_result"), any(ScopeCallback.class)),
                times(1));
        }
    }

    @Test
    void sameQueryWithinWindowReportedOnce() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1_000L, 2 * MIN, 5 * MIN);
        NlSearchEmptyResultReporter reporter = new NlSearchEmptyResultReporter(clock);

        try (MockedStatic<Sentry> sentry = mockStatic(Sentry.class)) {
            reporter.reportIfEmpty("강남역 파나타", 0);
            reporter.reportIfEmpty("강남역 파나타", 0);
            reporter.reportIfEmpty("강남역 파나타", 0);

            sentry.verify(
                () -> Sentry.captureMessage(eq("nl_search_empty_result"), any(ScopeCallback.class)),
                times(1));
        }
    }

    @Test
    void differentQueriesEachReportedOnce() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1_000L, 1_500L);
        NlSearchEmptyResultReporter reporter = new NlSearchEmptyResultReporter(clock);

        try (MockedStatic<Sentry> sentry = mockStatic(Sentry.class)) {
            reporter.reportIfEmpty("강남역 파나타", 0);
            reporter.reportIfEmpty("홍대 사이베스", 0);

            sentry.verify(
                () -> Sentry.captureMessage(eq("nl_search_empty_result"), any(ScopeCallback.class)),
                times(2));
        }
    }

    @Test
    void sameQueryAfterWindowExpiryReportedAgain() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1_000L, 7 * MIN);
        NlSearchEmptyResultReporter reporter = new NlSearchEmptyResultReporter(clock);

        try (MockedStatic<Sentry> sentry = mockStatic(Sentry.class)) {
            reporter.reportIfEmpty("강남역 파나타", 0);
            reporter.reportIfEmpty("강남역 파나타", 0);

            sentry.verify(
                () -> Sentry.captureMessage(eq("nl_search_empty_result"), any(ScopeCallback.class)),
                times(2));
        }
    }

    @Test
    void nonEmptyResultDoesNotCapture() {
        Clock clock = mock(Clock.class);
        when(clock.millis()).thenReturn(1_000L);
        NlSearchEmptyResultReporter reporter = new NlSearchEmptyResultReporter(clock);

        try (MockedStatic<Sentry> sentry = mockStatic(Sentry.class)) {
            reporter.reportIfEmpty("강남역 파나타", 5);

            sentry.verifyNoInteractions();
        }
    }

    @Test
    void nullTotalCountDoesNotCapture() {
        Clock clock = mock(Clock.class);
        NlSearchEmptyResultReporter reporter = new NlSearchEmptyResultReporter(clock);

        try (MockedStatic<Sentry> sentry = mockStatic(Sentry.class)) {
            reporter.reportIfEmpty("강남역 파나타", null);

            sentry.verifyNoInteractions();
        }
    }
}
