package com.ironspot.series;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V27 / machine_series: GET /api/series powers the unified brand-or-series
 * picker entry in the manual-input flow. The series catalog is closed and
 * small (~74 rows at launch), so the endpoint returns the full list ordered
 * by brand then series name and the client narrows with offline fuzzy.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SeriesListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void listSeriesReturns200() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/series", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void listSeriesReturnsSeededFixtures() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/series", String.class);
        String body = response.getBody();
        // init-test-db.sql seeds Monolith (Panatta) and Insignia (Life Fitness).
        assertThat(body).contains("\"name\":\"Monolith\"");
        assertThat(body).contains("\"name\":\"Insignia\"");
    }

    @Test
    void listSeriesResponseContainsExpectedFields() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/series", String.class);
        String body = response.getBody();
        assertThat(body).contains("\"id\"");
        assertThat(body).contains("\"brandId\"");
        assertThat(body).contains("\"name\"");
        assertThat(body).contains("\"nameKo\"");
    }

    @Test
    void listSeriesOrdersAlphabeticallyByBrandThenName() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/series", String.class);
        String body = response.getBody();
        // Life Fitness (Insignia) sorts before Panatta (Monolith) by brand name.
        int insigniaIdx = body.indexOf("\"name\":\"Insignia\"");
        int monolithIdx = body.indexOf("\"name\":\"Monolith\"");
        assertThat(insigniaIdx).isGreaterThan(0);
        assertThat(monolithIdx).isGreaterThan(insigniaIdx);
    }
}
