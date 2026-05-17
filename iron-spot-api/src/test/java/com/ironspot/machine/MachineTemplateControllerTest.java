package com.ironspot.machine;

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
 * ADR 0022 / Task 45 Slice 45f: machine template catalog endpoint.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class MachineTemplateControllerTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void listTemplatesReturnsApprovedTemplatesWithBrandAndLoadingType() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/machine-templates", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        // Seed has 2 templates (Panatta High Row pin + Life Fitness Chest Press plate)
        assertThat(body).contains("High Row");
        assertThat(body).contains("Chest Press");
        assertThat(body).contains("\"brandName\":\"Panatta\"");
        assertThat(body).contains("\"brandName\":\"Life Fitness\"");
        assertThat(body).contains("\"loadingType\":\"pin\"");
        assertThat(body).contains("\"loadingType\":\"plate\"");
    }

    @Test
    void listTemplatesSortsByBrandNameThenTemplateName() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/machine-templates", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        // Life Fitness < Panatta (alphabetically), so Life Fitness's Chest Press
        // appears before Panatta's High Row in the JSON array.
        int lifeFitnessIdx = body.indexOf("Life Fitness");
        int panattaIdx = body.indexOf("Panatta");
        assertThat(lifeFitnessIdx).isGreaterThan(0);
        assertThat(panattaIdx).isGreaterThan(lifeFitnessIdx);
    }
}
