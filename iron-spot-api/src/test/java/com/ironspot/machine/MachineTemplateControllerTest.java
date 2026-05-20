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
 * ADR 0022 / Task 45 Slice 45f introduced the endpoint. Phase 5 item 18 added
 * (a) the `nameEn` / `nameKo` split in the wire DTO and (b) optional
 * brandId / categoryId query params for picker-step filter pushdown.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class MachineTemplateControllerTest extends IntegrationTestBase {

    // Seeded by init-test-db.sql.
    private static final String BRAND_PANATTA_ID = "b0000001-0000-0000-0000-000000000001";
    private static final String CATEGORY_CHEST_ID = "c0000002-0000-0000-0000-000000000002";

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void listTemplatesReturnsApprovedTemplatesWithBilingualNames() {
        ResponseEntity<String> response =
            restTemplate.getForEntity("/api/machine-templates", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        // Seed has 2 templates (Panatta High Row pin + Life Fitness Chest Press plate).
        assertThat(body).contains("\"nameEn\":\"High Row\"");
        assertThat(body).contains("\"nameKo\":\"하이로우\"");
        assertThat(body).contains("\"nameEn\":\"Chest Press\"");
        assertThat(body).contains("\"nameKo\":\"체스트 프레스\"");
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

    @Test
    void listTemplatesNarrowsByBrandIdQueryParam() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machine-templates?brandId=" + BRAND_PANATTA_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        // Only Panatta's High Row should come back.
        assertThat(body).contains("\"nameEn\":\"High Row\"");
        assertThat(body).doesNotContain("\"nameEn\":\"Chest Press\"");
        assertThat(body).doesNotContain("Life Fitness");
    }

    @Test
    void listTemplatesNarrowsByCategoryIdQueryParam() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machine-templates?categoryId=" + CATEGORY_CHEST_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        // Only Chest Press (Life Fitness, 가슴 category) should come back.
        assertThat(body).contains("\"nameEn\":\"Chest Press\"");
        assertThat(body).doesNotContain("\"nameEn\":\"High Row\"");
        assertThat(body).doesNotContain("Panatta");
    }

    @Test
    void listTemplatesNarrowsByBothFiltersSimultaneously() {
        // Panatta + Chest produces zero matches in the seed (Panatta only has
        // a Back row). Verifies AND semantics rather than OR.
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machine-templates?brandId=" + BRAND_PANATTA_ID
                + "&categoryId=" + CATEGORY_CHEST_ID, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Empty array — no template row JSON object present.
        assertThat(response.getBody()).doesNotContain("\"nameEn\":");
    }
}
