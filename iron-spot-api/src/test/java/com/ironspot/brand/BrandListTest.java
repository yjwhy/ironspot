package com.ironspot.brand;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class BrandListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void getBrandsReturns200() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void getBrandsReturnsAllBrandsAlphabetically() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getBody()).contains("Panatta");
        assertThat(response.getBody()).contains("Life Fitness");
        // ORDER BY name: "Life Fitness" < "Panatta"
        assertThat(response.getBody()).satisfies(body -> {
            int lifeFitnessIdx = body.indexOf("Life Fitness");
            int panattaIdx = body.indexOf("Panatta");
            assertThat(lifeFitnessIdx).isLessThan(panattaIdx);
        });
    }

    @Test
    void getBrandsResponseContainsBrandFields() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getBody()).contains("\"name\"");
        assertThat(response.getBody()).contains("\"id\"");
        assertThat(response.getBody()).contains("\"nameKo\"");
    }

    @Test
    void getBrandsReturnsKoreanLocalisedNames() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getBody()).contains("파나타");
        assertThat(response.getBody()).contains("라이프 피트니스");
    }
}
