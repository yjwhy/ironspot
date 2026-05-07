package com.ironspot.category;

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
class CategoryListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void getCategoriesReturns200() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/categories", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void getCategoriesReturnsAllCategories() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/categories", String.class);
        assertThat(response.getBody()).contains("등");
        assertThat(response.getBody()).contains("가슴");
    }

    @Test
    void getCategoriesResponseContainsCategoryFields() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/categories", String.class);
        assertThat(response.getBody()).contains("\"name\"");
        assertThat(response.getBody()).contains("\"id\"");
    }
}
