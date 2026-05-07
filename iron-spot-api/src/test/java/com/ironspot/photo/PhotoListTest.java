package com.ironspot.photo;

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
class PhotoListTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void listPhotosReturnsNonBlindedPhotos() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/f0000001-0000-0000-0000-000000000001/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("test.jpg");
        assertThat(response.getBody()).doesNotContain("blinded.jpg");
        assertThat(response.getBody()).contains("\"success\":true");
    }

    @Test
    void listPhotosReturnsEmptyForUnknownMachine() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/00000000-0000-0000-0000-000000000000/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"data\":[]");
    }
}
