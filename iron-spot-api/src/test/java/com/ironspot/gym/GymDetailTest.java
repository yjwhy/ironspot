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
class GymDetailTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    private static final String KNOWN_GYM_ID = "a0000001-0000-0000-0000-000000000001";
    private static final String UNKNOWN_GYM_ID = "00000000-0000-0000-0000-000000000000";

    @Test
    void getGymByIdReturnsGym() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/" + KNOWN_GYM_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("테스트 헬스장");
        assertThat(response.getBody()).contains("\"success\":true");
    }

    @Test
    void getGymByUnknownIdReturns404() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/gyms/" + UNKNOWN_GYM_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
