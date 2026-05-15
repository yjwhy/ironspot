package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.exception.BusinessException;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static com.ironspot.jooq.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class NlSearchQuotaServiceIT extends IntegrationTestBase {

    @Autowired private NlSearchQuotaService quotaService;
    @Autowired private DSLContext dsl;

    // UUIDs in the 4x range avoid collision with AdminControllerIT's d0000077/88/99
    // and SlackSmokeControllerIT's d0000099 under the JVM-singleton Testcontainer.
    // @BeforeEach + @AfterEach both clean up by email suffix so any state carried
    // from a previous test class with the same UUID is also cleared.
    private static final String SEEDED_USER_ID = "d0000041-0000-0000-0000-000000000041";
    private static final String FIRST_TOUCH_USER_ID = "d0000042-0000-0000-0000-000000000042";
    private static final String EMAIL_SUFFIX = "@quota-it.local";

    @BeforeEach
    @AfterEach
    void cleanup() {
        dsl.deleteFrom(USERS)
            .where(USERS.EMAIL.like("%" + EMAIL_SUFFIX))
            .or(USERS.ID.in(UUID.fromString(SEEDED_USER_ID), UUID.fromString(FIRST_TOUCH_USER_ID)))
            .execute();
    }

    @Test
    void increments99Then100ThenRejects101() {
        seedUser(SEEDED_USER_ID, 97);
        UserPrincipal principal = principalOf(SEEDED_USER_ID);

        // 3 successful increments (98, 99, 100) verify the under-limit path
        // without paying for 99 sequential DB round-trips.
        quotaService.checkAndIncrement(principal);
        quotaService.checkAndIncrement(principal);
        quotaService.checkAndIncrement(principal);

        assertThat(countOf(SEEDED_USER_ID)).isEqualTo(100);
    }

    @Test
    void hundredthCallReturns429AndDoesNotIncrement() {
        seedUser(SEEDED_USER_ID, 99);
        UserPrincipal principal = principalOf(SEEDED_USER_ID);

        quotaService.checkAndIncrement(principal);  // 100th call: succeeds
        assertThat(countOf(SEEDED_USER_ID)).isEqualTo(100);

        assertThatThrownBy(() -> quotaService.checkAndIncrement(principal))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("이번 달")
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

        // The atomic WHERE count < 100 guard means the 101st call left count untouched.
        assertThat(countOf(SEEDED_USER_ID)).isEqualTo(100);
    }

    @Test
    void firstCallAfterResetSucceedsAgain() {
        seedUser(SEEDED_USER_ID, 100);
        UserPrincipal principal = principalOf(SEEDED_USER_ID);

        // Simulate the monthly cron resetting this user.
        dsl.update(USERS)
            .set(USERS.NL_SEARCH_COUNT_MONTH, 0)
            .where(USERS.ID.eq(UUID.fromString(SEEDED_USER_ID)))
            .execute();

        quotaService.checkAndIncrement(principal);

        assertThat(countOf(SEEDED_USER_ID)).isEqualTo(1);
    }

    @Test
    void firstTouchUserWithoutDbRowGetsCreatedAndIncrementedTo1() {
        // No seed — verifies the lazy upsert handles users who authenticated
        // but never hit /api/users/me before NL Search.
        UserPrincipal principal = principalOf(FIRST_TOUCH_USER_ID);

        quotaService.checkAndIncrement(principal);

        assertThat(countOf(FIRST_TOUCH_USER_ID))
            .as("lazy-created row should reach count=1 after first call")
            .isEqualTo(1);
    }

    private void seedUser(String userId, int count) {
        dsl.insertInto(USERS)
            .set(USERS.ID, UUID.fromString(userId))
            .set(USERS.EMAIL, userId + EMAIL_SUFFIX)
            .set(USERS.NICKNAME, "quota-it")
            .set(USERS.NL_SEARCH_COUNT_MONTH, count)
            .execute();
    }

    private int countOf(String userId) {
        return dsl.select(USERS.NL_SEARCH_COUNT_MONTH)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .fetchOne(USERS.NL_SEARCH_COUNT_MONTH);
    }

    private UserPrincipal principalOf(String userId) {
        return UserPrincipal.builder()
            .userId(userId)
            .email(userId + EMAIL_SUFFIX)
            .role("user")
            .build();
    }
}
