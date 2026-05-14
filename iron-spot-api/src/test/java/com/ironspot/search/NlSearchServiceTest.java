package com.ironspot.search;

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

    @InjectMocks
    private NlSearchService service;

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
        when(interpretationFormatter.format(dsl)).thenReturn("강남역 1km 안");

        NlSearchResponse response = service.search(req);

        assertThat(response.gyms()).containsExactly(gym);
        assertThat(response.interpretation()).isEqualTo("강남역 1km 안");
        assertThat(response.totalCount()).isEqualTo(1);
    }

    @Test
    void dslErrorThrowsBadRequest() {
        NlSearchRequest req = new NlSearchRequest("강남역 커피숍", 37.5, 127.0);
        SearchDsl dsl = new SearchDsl(null, List.of(), "gym search only");

        when(llmClient.parse("강남역 커피숍")).thenReturn(dsl);

        assertThatThrownBy(() -> service.search(req))
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

        assertThatThrownBy(() -> service.search(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("X");

        verify(sqlBuilder, never()).execute(any(), any());
    }

    private GymWithMachineCountResponse sampleGym() {
        return new GymWithMachineCountResponse(
            UUID.randomUUID(), "Gym", "Addr", 37.5, 127.0,
            null, null, null, true,
            null,
            Instant.now(), Instant.now(),
            0L
        );
    }
}
