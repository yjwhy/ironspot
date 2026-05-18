package com.ironspot.admin;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Authentication coverage for the operations dashboard chain
 * ({@link DashboardSecurityConfig}). Verifies Basic Auth enforcement on both
 * the static HTML and the JSON data endpoint without overlapping with the
 * JWT chain used for {@code /api/**}.
 *
 * <p>Test password is set in {@code application-test.properties} via
 * {@code dashboard.password=test-dashboard-password}. The startup fail-fast
 * (empty env) is covered indirectly by every other IT in the suite booting
 * the same context successfully.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class DashboardSecurityIT extends IntegrationTestBase {

    private static final String DASHBOARD_PASSWORD = "test-dashboard-password";

    @Autowired private TestRestTemplate restTemplate;

    @Test
    void dashboardHtmlReturns401WithoutCredentials() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/admin/dashboard.html", HttpMethod.GET, HttpEntity.EMPTY, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getHeaders().getFirst("WWW-Authenticate"))
            .as("Basic Auth prompt header so browsers show the dialog")
            .startsWith("Basic");
    }

    @Test
    void dashboardHtmlReturns401WithWrongPassword() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/admin/dashboard.html", HttpMethod.GET, basicAuth("wrong-password"), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void dashboardHtmlReturns200WithCorrectCredentials() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/admin/dashboard.html", HttpMethod.GET, basicAuth(DASHBOARD_PASSWORD), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .as("Spring Boot static-resource handler serves dashboard.html from src/main/resources/static/admin/")
            .contains("IronSpot Ops Dashboard");
    }

    @Test
    void dashboardDataEndpointReturnsJsonShapeWithCredentials() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/admin/dashboard/data?period=30d",
            HttpMethod.GET, basicAuth(DASHBOARD_PASSWORD), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        assertThat(body).contains("\"period\":\"30d\"");
        assertThat(body).contains("\"nlSearch\"");
        assertThat(body).contains("\"moderation\"");
        assertThat(body).contains("\"topQueries\"");
        assertThat(body).contains("\"banEvents\"");
    }

    @Test
    void dashboardDataEndpointReturns401WithoutCredentials() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/admin/dashboard/data?period=30d",
            HttpMethod.GET, HttpEntity.EMPTY, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void apiRoutesAreNotAffectedByDashboardChain() {
        // Regression check: the dashboard SecurityFilterChain's
        // .securityMatcher("/admin/dashboard/**") must not bleed into
        // /api/admin paths. Anonymous /api/admin should still return 401
        // from the JWT chain, not 200 (no auth) or 500 (chain confusion).
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports", HttpMethod.GET, HttpEntity.EMPTY, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpEntity<Void> basicAuth(String password) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth("admin", password);
        return new HttpEntity<>(headers);
    }
}
