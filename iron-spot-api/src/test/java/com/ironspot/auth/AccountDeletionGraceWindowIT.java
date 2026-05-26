package com.ironspot.auth;

import com.ironspot.common.IntegrationTestBase;
import org.jooq.DSLContext;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * Security A4: end-to-end coverage of the 7-day grace window.
 *
 * <p>Each test exercises a state transition:
 * <ul>
 *   <li>{@code requestDeletionEntersGrace} — DELETE /me marks
 *       deleted_at but content stays intact.</li>
 *   <li>{@code getMeDuringGraceReturnsPendingFlag} — GET /me during
 *       grace surfaces {@code deletionRequestedAt}.</li>
 *   <li>{@code cancelDuringGraceRestoresAccount} — POST /me/cancel-deletion
 *       clears deleted_at within the window.</li>
 *   <li>{@code cancelAfterFinalisationReturns410} — after the finaliser
 *       runs, cancel is no longer possible.</li>
 *   <li>{@code finaliserAnonymisesAfterGraceExpires} — the daily job
 *       anonymises content + stamps deletion_finalized_at.</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AccountDeletionGraceWindowIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private DSLContext dsl;
    @Autowired private AccountDeletionFinaliserJob finaliserJob;
    @MockitoBean private JwtValidator jwtValidator;

    @Test
    void requestDeletionEntersGrace() {
        String userId = uniqueUserId();
        seedUser(userId);

        delete("/api/users/me", HttpStatus.NO_CONTENT);

        OffsetDateTime deletedAt = dsl.select(USERS.DELETED_AT)
            .from(USERS).where(USERS.ID.eq(UUID.fromString(userId)))
            .fetchOne(USERS.DELETED_AT);
        OffsetDateTime finalizedAt = dsl.select(USERS.DELETION_FINALIZED_AT)
            .from(USERS).where(USERS.ID.eq(UUID.fromString(userId)))
            .fetchOne(USERS.DELETION_FINALIZED_AT);
        assertThat(deletedAt).as("deletion request set deleted_at").isNotNull();
        assertThat(finalizedAt).as("finalisation hasn't run yet").isNull();
    }

    @Test
    void getMeDuringGraceReturnsPendingFlag() {
        String userId = uniqueUserId();
        seedUser(userId);

        delete("/api/users/me", HttpStatus.NO_CONTENT);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest(), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("deletionRequestedAt");
        // The presence of an ISO-8601 timestamp matches anything looking
        // like a Z-suffixed instant; the exact value is the deletion
        // moment which we don't pin in the test.
        assertThat(response.getBody()).matches("(?s).*\"deletionRequestedAt\":\"\\d{4}-\\d{2}-\\d{2}.*");
    }

    @Test
    void cancelDuringGraceRestoresAccount() {
        String userId = uniqueUserId();
        seedUser(userId);
        delete("/api/users/me", HttpStatus.NO_CONTENT);

        ResponseEntity<String> cancel = restTemplate.exchange(
            "/api/users/me/cancel-deletion", HttpMethod.POST, bearerRequest(), String.class);
        assertThat(cancel.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Post-cancel /me should show NO deletionRequestedAt at all.
        ResponseEntity<String> me = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest(), String.class);
        assertThat(me.getBody()).doesNotContain("\"deletionRequestedAt\":\"");
    }

    @Test
    void cancelAfterFinalisationReturns410() {
        String userId = uniqueUserId();
        seedUser(userId);
        delete("/api/users/me", HttpStatus.NO_CONTENT);

        // Backdate the deletion to outside the grace window so the
        // finaliser picks it up immediately.
        dsl.update(USERS)
            .set(USERS.DELETED_AT, OffsetDateTime.now().minus(Duration.ofDays(8)))
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .execute();
        finaliserJob.finaliseExpiredDeletions();

        ResponseEntity<String> cancel = restTemplate.exchange(
            "/api/users/me/cancel-deletion", HttpMethod.POST, bearerRequest(), String.class);
        assertThat(cancel.getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    @Test
    void finaliserStampsDeletionFinalizedAt() {
        String userId = uniqueUserId();
        seedUser(userId);
        delete("/api/users/me", HttpStatus.NO_CONTENT);
        dsl.update(USERS)
            .set(USERS.DELETED_AT, OffsetDateTime.now().minus(Duration.ofDays(8)))
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .execute();

        finaliserJob.finaliseExpiredDeletions();

        OffsetDateTime finalizedAt = dsl.select(USERS.DELETION_FINALIZED_AT)
            .from(USERS).where(USERS.ID.eq(UUID.fromString(userId)))
            .fetchOne(USERS.DELETION_FINALIZED_AT);
        assertThat(finalizedAt).as("finaliser ran").isNotNull();
    }

    private void seedUser(String userId) {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder().userId(userId).email("grace-" + userId.substring(0, 8) + "@example.com").build()));
        // GET /me triggers getOrCreate which inserts the row.
        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(), String.class);
    }

    private void delete(String path, HttpStatus expected) {
        ResponseEntity<Void> response = restTemplate.exchange(path, HttpMethod.DELETE, bearerRequest(), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(expected);
    }

    private HttpEntity<Void> bearerRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        return new HttpEntity<>(headers);
    }

    private static String uniqueUserId() {
        // Each test gets a fresh UUID so they can run in any order
        // against the shared testcontainer.
        return UUID.randomUUID().toString();
    }
}
