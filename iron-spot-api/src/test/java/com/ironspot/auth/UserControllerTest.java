package com.ironspot.auth;

import com.ironspot.common.IntegrationTestBase;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.NL_SEARCH_LOG;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class UserControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    @Test
    void getMeReturns401WithoutToken() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/users/me", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMeReturns401WithInvalidToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("not-a-real-jwt");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.GET, entity, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMeCreatesAndReturnsUserOnFirstVisit() {
        // Security D2: init-test-db.sql seeds `test@example.com` for
        // user d0000001. The "first visit" path here MUST use a unique
        // email so the new INSERT doesn't collide with the seeded row
        // on the partial UNIQUE INDEX users_email_active_uniq.
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
                .email("first-visit@example.com")
                .build()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains("first-visit@example.com")
            .contains("\"role\":\"user\"");
    }

    @Test
    void getMeReturnsExistingUserOnSubsequentVisit() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("b2c3d4e5-f6a7-8901-bcde-f12345678901")
                .email("existing@example.com")
                .build()));

        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);
        ResponseEntity<String> secondResponse = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        assertThat(secondResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(secondResponse.getBody()).contains("existing@example.com");
    }

    @Test
    void updateMeReturns200WithValidNickname() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("c3d4e5f6-a7b8-9012-cdef-123456789012")
                .email("update@example.com")
                .build()));

        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> body = new HttpEntity<>("{\"nickname\":\"새닉네임\"}", headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.PUT, body, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("새닉네임");
    }

    @Test
    void updateMeReturns400WithBlankNickname() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("d4e5f6a7-b8c9-0123-defa-234567890123")
                .email("valid@example.com")
                .build()));

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> body = new HttpEntity<>("{\"nickname\":\"\"}", headers);
        ResponseEntity<String> response = restTemplate.exchange("/api/users/me", HttpMethod.PUT, body, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void deleteMeReturns204() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("e5f6a7b8-c9d0-1234-efab-345678901234")
                .email("delete@example.com")
                .build()));

        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.DELETE, bearerRequest(null), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void deleteMeAnonymisesNlSearchLogRows() {
        String userId = "a1b2c3d4-1111-2222-3333-444455556666";
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId(userId)
                .email("anonymise-delete@example.com")
                .build()));

        // Seed the user via the GET /me getOrCreate path so the FK in
        // nl_search_log.user_id has a target.
        restTemplate.exchange("/api/users/me", HttpMethod.GET, bearerRequest(null), String.class);

        UUID userUuid = UUID.fromString(userId);
        dsl.insertInto(NL_SEARCH_LOG)
            .set(NL_SEARCH_LOG.ID, UUID.randomUUID())
            .set(NL_SEARCH_LOG.USER_ID, userUuid)
            .set(NL_SEARCH_LOG.RAW_QUERY, "ANON-DEL-IT-사전 데이터")
            .set(NL_SEARCH_LOG.NORMALISED_QUERY, "anon-del-it-사전 데이터")
            .set(NL_SEARCH_LOG.OUTCOME, "success")
            .set(NL_SEARCH_LOG.DURATION_MS, 50)
            .set(NL_SEARCH_LOG.FILTER_COUNT, 1)
            .execute();

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.DELETE, bearerRequest(null), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Security A4: deletion REQUEST alone does not anonymise — the
        // 7-day grace window lets the user cancel. Anonymisation runs
        // in the finaliser when the window expires. So immediately
        // after DELETE the nl_search_log row is unchanged.
        Integer rowsByUser = dsl.fetchCount(NL_SEARCH_LOG, NL_SEARCH_LOG.USER_ID.eq(userUuid));
        Integer rowsByRaw = dsl.fetchCount(NL_SEARCH_LOG,
            NL_SEARCH_LOG.RAW_QUERY.eq("ANON-DEL-IT-사전 데이터"));
        assertThat(rowsByUser).as("user_id stays linked during grace window").isEqualTo(1);
        assertThat(rowsByRaw).as("raw_query stays intact during grace window").isEqualTo(1);

        // Simulate an expired grace window by backdating deleted_at and
        // running the finaliser directly. After this, the B8 contract
        // ("raw_query wiped + user_id NULLed") holds.
        dsl.update(com.ironspot.jooq.Tables.USERS)
            .set(com.ironspot.jooq.Tables.USERS.DELETED_AT,
                java.time.OffsetDateTime.now().minus(java.time.Duration.ofDays(8)))
            .where(com.ironspot.jooq.Tables.USERS.ID.eq(userUuid))
            .execute();
        finaliserJob.finaliseExpiredDeletions();

        Integer rowsByUserAfter = dsl.fetchCount(NL_SEARCH_LOG, NL_SEARCH_LOG.USER_ID.eq(userUuid));
        Integer rowsByRawAfter = dsl.fetchCount(NL_SEARCH_LOG,
            NL_SEARCH_LOG.RAW_QUERY.eq("ANON-DEL-IT-사전 데이터"));
        Integer rowsByRedacted = dsl.fetchCount(NL_SEARCH_LOG,
            NL_SEARCH_LOG.RAW_QUERY.eq("[redacted-on-delete]"));
        assertThat(rowsByUserAfter).as("user_id NULLed post-finalisation").isZero();
        assertThat(rowsByRawAfter).as("raw_query redacted post-finalisation").isZero();
        assertThat(rowsByRedacted).as("redacted row survives retention window").isGreaterThanOrEqualTo(1);

        // Cleanup
        dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.eq("[redacted-on-delete]"))
            .execute();
    }

    @Autowired private DSLContext dsl;
    @Autowired private AccountDeletionFinaliserJob finaliserJob;

    private HttpEntity<Void> bearerRequest(HttpHeaders extra) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        if (extra != null) extra.forEach(headers::addAll);
        return new HttpEntity<>(headers);
    }
}
