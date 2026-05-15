package com.ironspot.search;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.gym.NaverSearchService;
import com.ironspot.gym.dto.NaverPlaceResult;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import com.ironspot.search.dto.NlSearchResponse;
import com.ironspot.search.llm.LlmClient;
import com.ironspot.search.llm.LlmException;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.USERS;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class NlSearchControllerIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate rest;
    @Autowired private DSLContext dsl;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private LlmClient llmClient;
    @MockitoBean private NaverSearchService naverSearchService;

    @AfterEach
    void resetAuthedUserQuota() {
        // NL Search now lazy-creates a users row + increments its monthly counter, so
        // happy-path cases would leak count state across the JVM-singleton container.
        // UPDATE-reset (not DELETE) because AUTHED_USER (d0000077) is shared with
        // AdminControllerIT as REGULAR_ID — DELETE would risk FK violations from
        // any reports/photos that still reference the row.
        dsl.update(USERS)
            .set(USERS.NL_SEARCH_COUNT_MONTH, 0)
            .where(USERS.ID.eq(UUID.fromString(AUTHED_USER)))
            .execute();
    }

    // Seeded gym location (init-test-db.sql line 113: 127.0276 lng / 37.4979 lat)
    private static final double SEED_LAT = 37.4979;
    private static final double SEED_LNG = 127.0276;
    private static final String AUTHED_USER = "d0000077-0000-0000-0000-000000000077";

    @Test
    void happyPathReturnsSeededGymWithInterpretation() {
        mockAuth();
        given(llmClient.parse(anyString())).willReturn(new SearchDsl(
            new Location.Current(5.0),
            List.of(),
            null
        ));

        ResponseEntity<NlSearchResponse> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 헬스장", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), "token"),
            NlSearchResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().gyms())
            .as("seeded Yeoksam gym must be in results")
            .anyMatch(g -> g.name().equals("테스트 헬스장"));
        assertThat(resp.getBody().interpretation()).contains("내 위치");
    }

    @Test
    void namedPlaceGeocodingFillsCoordsAndFindsGym() {
        mockAuth();
        given(llmClient.parse(anyString())).willReturn(new SearchDsl(
            new Location.NamedPlace("역삼", null, 5.0),
            List.of(),
            null
        ));
        given(naverSearchService.search("역삼")).willReturn(List.of(
            new NaverPlaceResult("p1", "역삼역", "road", "addr", SEED_LAT, SEED_LNG, null, null)
        ));

        ResponseEntity<NlSearchResponse> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "역삼 헬스장", "userLat": 0, "userLng": 0 }
                """, "token"),
            NlSearchResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().gyms())
            .as("seeded Yeoksam gym must be in results after Naver geocode")
            .anyMatch(g -> g.name().equals("테스트 헬스장"));
        assertThat(resp.getBody().interpretation()).contains("역삼");
    }

    @Test
    void unknownBrandReturns400() {
        mockAuth();
        given(llmClient.parse(anyString())).willReturn(new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter("UnknownBrand", null, null, 1, SearchScope.EACH)),
            null
        ));

        ResponseEntity<String> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 UnknownBrand 머신", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), "token"),
            String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).contains("UnknownBrand");
    }

    @Test
    void llmTransportFailureReturns502() {
        mockAuth();
        given(llmClient.parse(anyString()))
            .willThrow(new LlmException(LlmException.Kind.TRANSPORT, "primary down"));

        ResponseEntity<String> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 헬스장", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), "token"),
            String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void dslParseErrorReturns400() {
        mockAuth();
        given(llmClient.parse(anyString())).willReturn(new SearchDsl(
            null, List.of(), "gym search only"));

        ResponseEntity<String> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 커피숍", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), "token"),
            String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).contains("헬스장 검색");
    }

    @Test
    void anonymousRequestReturns401() {
        ResponseEntity<String> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 헬스장", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), null),
            String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void quotaAtLimitReturns429AndDoesNotInvokeLlm() {
        mockAuth();
        // Upsert authed user at count=100 (the cap). ON CONFLICT DO UPDATE because
        // AdminControllerIT may have already seeded this UUID as REGULAR_ID.
        dsl.insertInto(USERS)
            .set(USERS.ID, UUID.fromString(AUTHED_USER))
            .set(USERS.EMAIL, "u@example.com")
            .set(USERS.NICKNAME, "quota-cap")
            .set(USERS.NL_SEARCH_COUNT_MONTH, 100)
            .onConflict(USERS.ID)
            .doUpdate()
            .set(USERS.NL_SEARCH_COUNT_MONTH, 100)
            .execute();

        ResponseEntity<String> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 헬스장", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), "token"),
            String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(resp.getBody()).contains("한도");
        verifyNoInteractions(llmClient);
    }

    @Test
    void combinedScopeWithMatchingMinCountSucceeds() {
        // Seeded gym has Panatta High Row qty=2. COMBINED Panatta+LifeFitness SUM>=1 → matches.
        mockAuth();
        given(llmClient.parse(anyString())).willReturn(new SearchDsl(
            new Location.Current(5.0),
            List.of(
                new MachineFilter("Panatta", null, null, 1, SearchScope.COMBINED),
                new MachineFilter("Life Fitness", null, null, 1, SearchScope.COMBINED)
            ),
            null
        ));

        ResponseEntity<NlSearchResponse> resp = rest.exchange(
            "/api/search/natural",
            org.springframework.http.HttpMethod.POST,
            jsonBody("""
                { "query": "근처 파나타나 라이프피트니스 합쳐서 1개", "userLat": %s, "userLng": %s }
                """.formatted(SEED_LAT, SEED_LNG), "token"),
            NlSearchResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().gyms())
            .as("seeded Yeoksam gym (with Panatta High Row) satisfies combined SUM>=1")
            .anyMatch(g -> g.name().equals("테스트 헬스장"));
        assertThat(resp.getBody().interpretation()).contains("또는");
    }

    private void mockAuth() {
        UserPrincipal principal = UserPrincipal.builder()
            .userId(AUTHED_USER)
            .email("u@example.com")
            .role("user")
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    private HttpEntity<String> jsonBody(String body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }
}
