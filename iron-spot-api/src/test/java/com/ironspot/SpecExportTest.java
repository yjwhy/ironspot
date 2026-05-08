package com.ironspot;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SpecExportTest extends IntegrationTestBase {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void exportOpenApiSpec() throws IOException {
        ResponseEntity<String> response = restTemplate.getForEntity("/api-docs", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotEmpty();
        assertThat(response.getBody()).contains("\"openapi\"");
        assertThat(response.getBody()).contains("\"/api/gyms/search\"");

        // Normalise the ephemeral RANDOM_PORT to a stable placeholder so openapi.json
        // does not produce a noisy git diff on every regeneration.
        // Working directory is iron-spot-api/ during Gradle test execution.
        String spec = response.getBody()
                .replaceAll("\"url\":\"http://localhost:\\d+\"", "\"url\":\"http://localhost:8080\"");

        Path outputPath = Path.of("../openapi.json");
        Files.writeString(outputPath, spec);
    }
}
