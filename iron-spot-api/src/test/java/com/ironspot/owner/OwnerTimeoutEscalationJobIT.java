package com.ironspot.owner;

import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest
class OwnerTimeoutEscalationJobIT extends IntegrationTestBase {

    @Autowired private OwnerTimeoutEscalationJob job;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private AdminNotificationService notifier;

    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
            UUID.fromString("d0000151-0000-0000-0000-000000000151"), "esc-rep@example.com", "신고자");
        jdbcTemplate.update("DELETE FROM reports");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM reports");
    }

    @Test
    void expiredOwnerTimeoutsAreCleared() {
        UUID expired = UUID.randomUUID();
        UUID secondExpired = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, photo_id, reason, status, owner_timeout_at) "
                + "VALUES (?, ?, ?, 'INAPPROPRIATE', 'pending', ?)",
            expired, UUID.fromString("d0000151-0000-0000-0000-000000000151"), PHOTO_ID,
            java.sql.Timestamp.from(OffsetDateTime.now().minusMinutes(5).toInstant()));
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, photo_id, reason, status, owner_timeout_at) "
                + "VALUES (?, ?, ?, 'OTHER', 'pending', ?)",
            secondExpired, UUID.fromString("d0000151-0000-0000-0000-000000000151"),
            UUID.fromString("aa000002-0000-0000-0000-000000000002"),
            java.sql.Timestamp.from(OffsetDateTime.now().minusMinutes(10).toInstant()));

        job.escalate();

        java.sql.Timestamp ts1 = jdbcTemplate.queryForObject(
            "SELECT owner_timeout_at FROM reports WHERE id = ?",
            java.sql.Timestamp.class, expired);
        java.sql.Timestamp ts2 = jdbcTemplate.queryForObject(
            "SELECT owner_timeout_at FROM reports WHERE id = ?",
            java.sql.Timestamp.class, secondExpired);
        assertThat(ts1).isNull();
        assertThat(ts2).isNull();

        verify(notifier, times(1)).notifyOwnerTimeoutEscalated(eq(2));
    }

    @Test
    void inWindowReportsAreUntouched() {
        UUID inWindow = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, photo_id, reason, status, owner_timeout_at) "
                + "VALUES (?, ?, ?, 'INAPPROPRIATE', 'pending', ?)",
            inWindow, UUID.fromString("d0000151-0000-0000-0000-000000000151"), PHOTO_ID,
            java.sql.Timestamp.from(OffsetDateTime.now().plusHours(20).toInstant()));

        job.escalate();

        java.sql.Timestamp ts = jdbcTemplate.queryForObject(
            "SELECT owner_timeout_at FROM reports WHERE id = ?",
            java.sql.Timestamp.class, inWindow);
        assertThat(ts).isNotNull();

        verify(notifier, never()).notifyOwnerTimeoutEscalated(org.mockito.ArgumentMatchers.anyInt());
    }
}
