package com.ironspot.brand;

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
class BrandListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void getBrandsReturns200() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void getBrandsReturnsAllBrands() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getBody()).contains("Panatta");
        assertThat(response.getBody()).contains("Life Fitness");
    }

    @Test
    void getBrandsResponseHasSuccessTrue() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/brands", String.class);
        assertThat(response.getBody()).contains("\"success\":true");
    }
}
