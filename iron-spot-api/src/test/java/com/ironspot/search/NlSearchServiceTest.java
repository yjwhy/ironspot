package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.search.dsl.Coordinates;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dto.NlSearchRequest;
import com.ironspot.search.dto.NlSearchResponse;
import com.ironspot.search.llm.LlmClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NlSearchServiceTest {

    @Mock
    private LlmClient llmClient;
    @Mock
    private DslValidator dslValidator;
    @Mock
    private LocationResolver locationResolver;
    @Mock
    private SqlBuilder sqlBuilder;
    @Mock
    private InterpretationFormatter interpretationFormatter;
    @Mock
    private NlSearchQuotaService quotaService;
    @Mock
    private NlSearchEmptyResultReporter emptyResultReporter;
    @Mock
    private NlSearchLogWriter logWriter;

    @InjectMocks
    private NlSearchService service;

    private final UserPrincipal principal = UserPrincipal.builder()
        .userId("d0000041-0000-0000-0000-000000000041")
        .email("svc-test@local")
        .role("user")
        .build();

    @Test
    void happyPathReturnsComposedResponse() {
        NlSearchRequest req = new NlSearchRequest("강남역 근처 헬스장", 37.5, 127.0);
        SearchDsl dsl = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0),
            List.of(),
            null
        );
        ValidatedSearch validated = new ValidatedSearch(dsl.location(), List.of());
        ResolvedLocation resolved = new ResolvedLocation(new Coordinates(37.498, 127.027), 1.0);
        GymWithMachineCountResponse gym = sampleGym();

        when(llmClient.parse("강남역 근처 헬스장")).thenReturn(dsl);
        when(dslValidator.validate(dsl)).thenReturn(validated);
        when(locationResolver.resolve(dsl.location(), 37.5, 127.0)).thenReturn(resolved);
        when(sqlBuilder.execute(resolved, List.of())).thenReturn(List.of(gym));
        when(interpretationFormatter.format(dsl)).thenReturn("강남역 1km 이내");

        NlSearchResponse response = service.search(req, principal);

        assertThat(response.gyms()).containsExactly(gym);
        assertThat(response.interpretation()).isEqualTo("강남역 1km 이내");
        assertThat(response.totalCount()).isEqualTo(1);
    }

    @Test
    void dslErrorThrowsBadRequest() {
        NlSearchRequest req = new NlSearchRequest("강남역 커피숍", 37.5, 127.0);
        SearchDsl dsl = new SearchDsl(null, List.of(), "gym search only");

        when(llmClient.parse("강남역 커피숍")).thenReturn(dsl);

        assertThatThrownBy(() -> service.search(req, principal))
            .isInstanceOfSatisfying(BusinessException.class, e ->
                assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST))
            .hasMessageContaining("헬스장 검색만 가능해요");

        verify(dslValidator, never()).validate(any());
        verify(sqlBuilder, never()).execute(any(), any());
    }

    @Test
    void validatorBusinessExceptionPropagates() {
        NlSearchRequest req = new NlSearchRequest("unknown brand", 37.5, 127.0);
        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(),
            null
        );
        when(llmClient.parse("unknown brand")).thenReturn(dsl);
        when(dslValidator.validate(dsl))
            .thenThrow(new BusinessException("'X' 브랜드는 등록되지 않았어요.", HttpStatus.BAD_REQUEST));

        assertThatThrownBy(() -> service.search(req, principal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("X");

        verify(sqlBuilder, never()).execute(any(), any());
    }

    @Test
    void quotaExceededShortCircuitsBeforeLlmCall() {
        NlSearchRequest req = new NlSearchRequest("아무 검색", 37.5, 127.0);
        doThrow(new BusinessException(
            "이번 달 자연어 검색 한도를 모두 사용했어요. 다음 달 1일에 초기화됩니다.",
            HttpStatus.TOO_MANY_REQUESTS))
            .when(quotaService).checkAndIncrement(principal);

        assertThatThrownBy(() -> service.search(req, principal))
            .isInstanceOfSatisfying(BusinessException.class, e ->
                assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS))
            .hasMessageContaining("한도");

        // Whole downstream pipeline must remain untouched when quota gates the request.
        verify(llmClient, never()).parse(any());
        verify(dslValidator, never()).validate(any());
        verify(sqlBuilder, never()).execute(any(), any());
    }

    @Test
    void emptyResultTriggersReporter() {
        NlSearchRequest req = new NlSearchRequest("강남역 라이프피트니스", 37.5, 127.0);
        SearchDsl dsl = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0),
            List.of(),
            null
        );
        ValidatedSearch validated = new ValidatedSearch(dsl.location(), List.of());
        ResolvedLocation resolved = new ResolvedLocation(new Coordinates(37.498, 127.027), 1.0);

        when(llmClient.parse("강남역 라이프피트니스")).thenReturn(dsl);
        when(dslValidator.validate(dsl)).thenReturn(validated);
        when(locationResolver.resolve(dsl.location(), 37.5, 127.0)).thenReturn(resolved);
        when(sqlBuilder.execute(resolved, List.of())).thenReturn(List.of());
        when(interpretationFormatter.format(dsl)).thenReturn("강남역 1km 이내");

        NlSearchResponse response = service.search(req, principal);

        assertThat(response.totalCount()).isZero();
        verify(emptyResultReporter).reportIfEmpty("강남역 라이프피트니스", 0);
    }

    @Test
    void quotaFailureForwardsNullCountToReporter() {
        // Failing-before-SQL keeps totalCount null; reporter must still be invoked so the
        // finally-block contract is uniform across paths. Reporter itself ignores null.
        NlSearchRequest req = new NlSearchRequest("아무 검색", 37.5, 127.0);
        doThrow(new BusinessException(
            "이번 달 자연어 검색 한도를 모두 사용했어요. 다음 달 1일에 초기화됩니다.",
            HttpStatus.TOO_MANY_REQUESTS))
            .when(quotaService).checkAndIncrement(principal);

        assertThatThrownBy(() -> service.search(req, principal))
            .isInstanceOf(BusinessException.class);

        verify(emptyResultReporter).reportIfEmpty(eq("아무 검색"), eq(null));
    }

    private GymWithMachineCountResponse sampleGym() {
        return new GymWithMachineCountResponse(
            UUID.randomUUID(), "Gym", "Addr", 37.5, 127.0,
            null, null, null, true,
            null,
            Instant.now(), Instant.now(),
            0L,
            List.of()
        );
    }
}
