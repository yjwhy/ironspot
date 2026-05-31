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

/**
 * Map filter "nearby count" badges: GET /api/gyms/template-counts returns, per
 * machine template, the number of distinct gyms within the bbox that have it
 * (active gym_machines only). Seed: one Gangnam gym with High Row
 * (e0000001, Panatta/Monolith) + Chest Press (e0000002, Life Fitness).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class GymTemplateCountsTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @MockitoBean
    private JwtValidator jwtValidator;

    private static final String TEST_USER_ID = "d0000001-0000-0000-0000-000000000001";
    private static final String HIGH_ROW_ID = "e0000001-0000-0000-0000-000000000001";
    private static final String CHEST_PRESS_ID = "e0000002-0000-0000-0000-000000000002";

    private static final String GANGNAM_BOUNDS =
        "?minLat=37.49&maxLat=37.51&minLng=127.02&maxLng=127.04";
    private static final String HONGDAE_BOUNDS =
        "?minLat=37.55&maxLat=37.56&minLng=126.92&maxLng=126.93";

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
    void returnsGymCountPerTemplateWithinBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/template-counts" + GANGNAM_BOUNDS, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Both templates are held by the one Gangnam gym → gymCount 1 each.
        assertThat(response.getBody()).contains(HIGH_ROW_ID);
        assertThat(response.getBody()).contains(CHEST_PRESS_ID);
        assertThat(response.getBody()).contains("\"gymCount\":1");
    }

    @Test
    void omitsTemplatesWithNoGymInBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/template-counts" + HONGDAE_BOUNDS, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // No gym near Hongdae → the Gangnam gym's templates must not appear.
        assertThat(response.getBody()).doesNotContain(HIGH_ROW_ID);
        assertThat(response.getBody()).doesNotContain(CHEST_PRESS_ID);
    }

    @Test
    void rejectsRequestWithoutBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/template-counts", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
