package com.ironspot.gym;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class GymSearchTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    // Gangnam bounds that include the test gym at (lat=37.4979, lng=127.0276)
    private static final String GANGNAM_BOUNDS =
        "?minLat=37.49&maxLat=37.51&minLng=127.02&maxLng=127.04";

    // Hongdae bounds (lat ~37.55-37.56, lng ~126.92-126.93)
    private static final String HONGDAE_BOUNDS =
        "?minLat=37.55&maxLat=37.56&minLng=126.92&maxLng=126.93";

    @Test
    void searchReturnsGymsWithinBounds() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/search" + GANGNAM_BOUNDS, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
        assertThat(response.getBody()).contains("\"success\":true");
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
            + "&brandId=b0000001-0000-0000-0000-000000000001";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchFiltersByLoadingTypePinReturnsGym() {
        String url = "/api/gyms/search" + GANGNAM_BOUNDS + "&loadingType=pin";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
    }

    @Test
    void searchFiltersByLoadingTypePlateDoesNotReturnGym() {
        // The test gym only has a pin-loaded machine, so plate filter should exclude it
        String url = "/api/gyms/search" + GANGNAM_BOUNDS + "&loadingType=plate";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("테스트 헬스장");
    }
}
