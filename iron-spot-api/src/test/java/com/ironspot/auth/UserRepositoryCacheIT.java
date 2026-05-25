package com.ironspot.auth;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Security task #24 — verifies the @Cacheable + @CacheEvict wiring on
 * {@link UserRepository#findAuthContext(String)}.
 *
 * <p>Strategy: side-step the cache eviction by mutating banned_at via
 * raw JDBC (so the cache stays warm), then assert the second lookup
 * still returns the cached value. After {@link UserRepository#markBanned}
 * is called, the eviction kicks in and the lookup must reflect the new
 * banned_at.
 *
 * <p>Why an IT not a unit test: @Cacheable is woven by Spring's AOP proxy
 * at context creation time, so the cache only takes effect when the
 * repository is resolved through Spring (autowired). A pure Mockito
 * test on the unproxied bean would never see the cache.
 */
@SpringBootTest
class UserRepositoryCacheIT extends IntegrationTestBase {

    @Autowired private UserRepository userRepository;
    @Autowired private CacheManager cacheManager;
    @Autowired private JdbcTemplate jdbc;

    private static final UUID USER_ID = UUID.fromString("f0000024-0000-0000-0000-000000000024");

    @BeforeEach
    void cleanUp() {
        if (cacheManager.getCache("authContext") != null) {
            cacheManager.getCache("authContext").clear();
        }
        jdbc.update("DELETE FROM users WHERE id = ?", USER_ID);
        jdbc.update(
            "INSERT INTO users (id, email, nickname, role) VALUES (?, ?, ?, 'user')",
            USER_ID, "task24@example.com", "task24");
    }

    @Test
    void findAuthContext_cachesResultAcrossCalls() {
        Optional<UserAuthContext> first = userRepository.findAuthContext(USER_ID.toString());
        assertThat(first).isPresent();
        assertThat(first.get().bannedAt()).isNull();

        // Bypass markBanned() so no @CacheEvict fires. The cache should
        // still serve the stale "not banned" view.
        jdbc.update("UPDATE users SET banned_at = NOW() WHERE id = ?", USER_ID);

        Optional<UserAuthContext> cached = userRepository.findAuthContext(USER_ID.toString());
        assertThat(cached).isPresent();
        assertThat(cached.get().bannedAt())
            .as("cache should still return the pre-ban view")
            .isNull();
    }

    @Test
    void markBanned_evictsCachedAuthContext() {
        userRepository.findAuthContext(USER_ID.toString());
        userRepository.markBanned(USER_ID.toString());

        Optional<UserAuthContext> afterBan = userRepository.findAuthContext(USER_ID.toString());
        assertThat(afterBan).isPresent();
        assertThat(afterBan.get().bannedAt())
            .as("markBanned must evict so the next lookup hits the DB")
            .isNotNull();
    }

    @Test
    void markUnbanned_evictsCachedAuthContext() {
        jdbc.update("UPDATE users SET banned_at = NOW() WHERE id = ?", USER_ID);
        userRepository.findAuthContext(USER_ID.toString());

        userRepository.markUnbanned(USER_ID.toString());

        Optional<UserAuthContext> afterUnban = userRepository.findAuthContext(USER_ID.toString());
        assertThat(afterUnban).isPresent();
        assertThat(afterUnban.get().bannedAt())
            .as("markUnbanned must evict so the next lookup sees null")
            .isNull();
    }

    @Test
    void markDeleted_evictsCachedAuthContext() {
        userRepository.findAuthContext(USER_ID.toString());
        userRepository.markDeleted(USER_ID.toString());

        Optional<UserAuthContext> afterDelete = userRepository.findAuthContext(USER_ID.toString());
        assertThat(afterDelete)
            .as("markDeleted must evict so the next lookup respects deleted_at filter")
            .isEmpty();
    }
}
