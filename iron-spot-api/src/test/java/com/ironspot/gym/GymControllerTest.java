package com.ironspot.gym;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.gym.dto.CreateGymRequest;
import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.NaverPlaceResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class GymControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private NaverSearchService naverSearchService;

    private static final String USER_ID = "d0000003-0000-0000-0000-000000000003";

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_ID), "naveruser@example.com", "NaverUser"
        );
        given(jwtValidator.validate(anyString()))
            .willReturn(Optional.of(UserPrincipal.builder()
                .userId(USER_ID)
                .email("naveruser@example.com")
                .nickname("NaverUser")
                .build()));
    }

    private HttpHeaders authedHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth("fake-token");
        return headers;
    }

    // ─── /places-search auth gate ──────────────────────────────────────────────

    @Test
    void placesSearchRequiresAuth() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/gyms/places-search?query=헬스장", String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void placesSearchReturnsNaverResultsWhenAuthenticated() {
        given(naverSearchService.search("헬스장")).willReturn(List.of(
            new NaverPlaceResult(
                "12345", "에어짐", "서울특별시 강남대로 1", "서울 강남구 1",
                37.4979, 127.0276, "02-1234-5678", "스포츠시설>헬스장"
            )
        ));

        ResponseEntity<List<NaverPlaceResult>> response = restTemplate.exchange(
            "/api/gyms/places-search?query=헬스장",
            HttpMethod.GET,
            new HttpEntity<>(authedHeaders()),
            new ParameterizedTypeReference<>() {}
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).id()).isEqualTo("12345");
    }

    @Test
    void placesSearchRejectsBlankQuery() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gyms/places-search?query=",
            HttpMethod.GET,
            new HttpEntity<>(authedHeaders()),
            String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ─── GET /api/gyms auth gate (security task #20) ──────────────────────────

    @Test
    void searchAnonymousReturnsUnauthorized() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gyms/search?minLat=37.0&maxLat=37.5&minLng=127.0&maxLng=127.5",
            HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()),
            String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getByIdAnonymousReturnsUnauthorized() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gyms/a0000001-0000-0000-0000-000000000001",
            HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()),
            String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ─── POST /api/gyms auth gate + dedup ──────────────────────────────────────

    @Test
    void createGymRequiresAuth() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gyms",
            HttpMethod.POST,
            new HttpEntity<>(validBody("anon-place"), headers),
            String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void createGymInsertsNewRowAndReturnsIt() {
        // Security C4: pure-digit Naver-ID format passes the CHECK
        // constraint gyms_naver_place_id_shape_check.
        String placeId = "4" + System.nanoTime();
        ResponseEntity<GymDetailResponse> response = restTemplate.exchange(
            "/api/gyms",
            HttpMethod.POST,
            new HttpEntity<>(validBody(placeId), authedHeaders()),
            GymDetailResponse.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().isVerified()).isFalse();
        assertThat(response.getBody().name()).isEqualTo("새 헬스장");
    }

    @Test
    void createGymIsIdempotentOnNaverPlaceId() {
        // Security C4: pure-digit Naver-ID format passes the CHECK constraint.
        String placeId = "5" + System.nanoTime();
        ResponseEntity<GymDetailResponse> first = restTemplate.exchange(
            "/api/gyms",
            HttpMethod.POST,
            new HttpEntity<>(validBody(placeId), authedHeaders()),
            GymDetailResponse.class
        );
        ResponseEntity<GymDetailResponse> second = restTemplate.exchange(
            "/api/gyms",
            HttpMethod.POST,
            new HttpEntity<>(validBody(placeId), authedHeaders()),
            GymDetailResponse.class
        );

        assertThat(first.getBody().id()).isEqualTo(second.getBody().id());
    }

    @Test
    void createGymRejectsMissingFields() {
        String missingNameJson = """
            {
              "address": "서울특별시 어딘가",
              "latitude": 37.5,
              "longitude": 127.0,
              "naverPlaceId": "p1"
            }
            """;
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gyms",
            HttpMethod.POST,
            new HttpEntity<>(missingNameJson, authedHeaders()),
            String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private static String validBody(String placeId) {
        return """
            {
              "name": "새 헬스장",
              "address": "서울특별시 테헤란로 100",
              "latitude": 37.4979,
              "longitude": 127.0276,
              "phone": "02-9999-9999",
              "naverPlaceId": "%s"
            }
            """.formatted(placeId);
    }
}
