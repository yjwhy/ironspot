package com.ironspot.gym;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class GymSearchTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private JwtValidator jwtValidator;

    private static final String TEST_USER_ID = "d0000001-0000-0000-0000-000000000001";

    // Gangnam bounds that include the test gym at (lat=37.4979, lng=127.0276)
    private static final String GANGNAM_BOUNDS =
        "?minLat=37.49&maxLat=37.51&minLng=127.02&maxLng=127.04";

    // Hongdae bounds (lat ~37.55-37.56, lng ~126.92-126.93)
    private static final String HONGDAE_BOUNDS =
        "?minLat=37.55&maxLat=37.56&minLng=126.92&maxLng=126.93";

    /**
     * Security task #20 — /api/gyms/** GET now requires auth. Attach a
     * bearer header via rest template interceptor so existing call sites
     * keep their {@code getForEntity} signatures unchanged.
     */
    @BeforeEach
    void setUp() {
        given(jwtValidator.validate(anyString()))
            .willReturn(Optional.of(UserPrincipal.builder()
                .userId(TEST_USER_ID)
                .email("test@example.com")
                .nickname("테스트유저")
                .build()));
        restTemplate.getRestTemplate().setInterceptors(List.of(
            (request, body, execution) -> {
                request.getHeaders().setBearerAuth("fake-token");
                return execution.execute(request, body);
            }
        ));
    }

    @Test
    void searchReturnsGymsWithinBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/search" + GANGNAM_BOUNDS, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchReturnsBadRequestWithoutBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/search", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void searchDoesNotReturnGymOutsideBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/search" + HONGDAE_BOUNDS, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("테스트 헬스장");
    }

    @Test
    void searchFiltersByBrandId() {
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&brandIds=b0000001-0000-0000-0000-000000000001";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchFiltersByMultipleBrandIds() {
        // OR semantics: matching brand b0000001 should include the gym even when an
        // unrelated brand is also requested.
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&brandIds=b0000001-0000-0000-0000-000000000001"
            + "&brandIds=b0000099-0000-0000-0000-000000000099";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchExcludesGymWhenNoBrandIdMatches() {
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&brandIds=b0000099-0000-0000-0000-000000000099";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("테스트 헬스장");
    }

    @Test
    void searchFiltersByTemplateIdEachReturnsGym() {
        // ADR 0022 / Slice 45c: EACH (OR) — gym has template e0000001, returns.
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&templateIds=e0000001-0000-0000-0000-000000000001"
            + "&scope=each";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchFiltersByMultipleTemplateIdsEachReturnsGymOnAnyMatch() {
        // EACH (OR) — gym has e0000001 but not e0000099, still returns (OR semantics).
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&templateIds=e0000099-0000-0000-0000-000000000099"
            + "&templateIds=e0000001-0000-0000-0000-000000000001";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchExcludesGymWhenTemplateIdEachDoesNotMatch() {
        // EACH (OR) — gym has no e0000099 template, excluded.
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&templateIds=e0000099-0000-0000-0000-000000000099";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("테스트 헬스장");
    }

    @Test
    void searchCombinedScopeReturnsGymWhenAllTemplatesPresent() {
        // COMBINED (AND) — gym has both e0000001 + e0000002 (seed: Slice 45c
        // 확장), returns. This is the user's compound search use case (ADR 0022).
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&templateIds=e0000001-0000-0000-0000-000000000001"
            + "&templateIds=e0000002-0000-0000-0000-000000000002"
            + "&scope=combined";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchCombinedScopeExcludesGymWhenAnyTemplateMissing() {
        // COMBINED (AND) — gym has e0000001 but not e0000099, excluded.
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&templateIds=e0000001-0000-0000-0000-000000000001"
            + "&templateIds=e0000099-0000-0000-0000-000000000099"
            + "&scope=combined";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("테스트 헬스장");
    }

    @Test
    void searchReturnsMatchedMachineNamesInResponse() {
        // ADR 0022 / Slice 45d: response includes matchedMachineNames (top 5,
        // sorted, "Brand TemplateName" format). gym a0000001 has Panatta High Row
        // + Life Fitness Chest Press (seed). 둘 다 응답에 포함되어야 함.
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/search" + GANGNAM_BOUNDS, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Panatta High Row");
        assertThat(response.getBody()).contains("Life Fitness Chest Press");
        assertThat(response.getBody()).contains("matchedMachineNames");
    }

    @Test
    void searchMatchedMachineNamesRespectsBrandFilter() {
        // Brand=Panatta 필터 시 matchedMachineNames 는 Panatta 머신만 포함.
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&brandIds=b0000001-0000-0000-0000-000000000001";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("Panatta High Row");
        assertThat(response.getBody()).doesNotContain("Life Fitness Chest Press");
    }

    @Test
    void searchFiltersByCategoryId() {
        String url = "/api/gyms/search" + GANGNAM_BOUNDS
            + "&categoryIds=c0000001-0000-0000-0000-000000000001";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }
}
