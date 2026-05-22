package com.ironspot.photo;

import com.ironspot.common.IntegrationTestBase;
import com.ironspot.photo.dto.VisionAnalysisResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 5 cost safety net (Layer C): SHA-256 dedupe cache. Verifies
 * insert / lookup / hit count bumping / NULL miss / serialisation round-trip
 * for the {@code vision_cache} table.
 */
@SpringBootTest
class VisionCacheRepositoryIT extends IntegrationTestBase {

    @Autowired private VisionCacheRepository visionCacheRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanup() {
        jdbcTemplate.update("DELETE FROM vision_cache WHERE sha256 LIKE 'it-cache-%'");
    }

    @Test
    void sha256IsDeterministicHexOfBytes() {
        byte[] bytes = "iron-spot test image bytes".getBytes();
        String a = VisionCacheRepository.sha256(bytes);
        String b = VisionCacheRepository.sha256(bytes);

        assertThat(a).isEqualTo(b);
        assertThat(a).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    void missReturnsEmpty() {
        Optional<VisionAnalysisResult> result =
            visionCacheRepository.findBySha256("it-cache-never-stored");
        assertThat(result).isEmpty();
    }

    @Test
    void insertThenFindRoundTripsAllFields() {
        String key = "it-cache-roundtrip-key";
        VisionAnalysisResult original = new VisionAnalysisResult(
            List.of("HAMMER STRENGTH", "Lat Pull Down", "랫 풀다운"),
            SafeSearchVerdict.QUEUE_FOR_ADMIN,
            true
        );

        visionCacheRepository.insert(key, original);
        Optional<VisionAnalysisResult> roundtripped = visionCacheRepository.findBySha256(key);

        assertThat(roundtripped).isPresent();
        assertThat(roundtripped.get().texts())
            .containsExactly("HAMMER STRENGTH", "Lat Pull Down", "랫 풀다운");
        assertThat(roundtripped.get().verdict()).isEqualTo(SafeSearchVerdict.QUEUE_FOR_ADMIN);
        assertThat(roundtripped.get().hasPii()).isTrue();
    }

    @Test
    void insertOnConflictIsNoOp() {
        String key = "it-cache-conflict";
        VisionAnalysisResult first = new VisionAnalysisResult(
            List.of("first"), SafeSearchVerdict.ALLOW, false);
        VisionAnalysisResult second = new VisionAnalysisResult(
            List.of("second"), SafeSearchVerdict.REJECT, true);

        visionCacheRepository.insert(key, first);
        visionCacheRepository.insert(key, second);  // ON CONFLICT DO NOTHING

        Optional<VisionAnalysisResult> stored = visionCacheRepository.findBySha256(key);
        assertThat(stored).isPresent();
        assertThat(stored.get().texts()).containsExactly("first");
        assertThat(stored.get().verdict()).isEqualTo(SafeSearchVerdict.ALLOW);
    }

    @Test
    void bumpHitCountIncrementsAndPersists() {
        String key = "it-cache-bump";
        visionCacheRepository.insert(key, VisionAnalysisResult.EMPTY);

        visionCacheRepository.bumpHitCount(key);
        visionCacheRepository.bumpHitCount(key);
        visionCacheRepository.bumpHitCount(key);

        Integer count = jdbcTemplate.queryForObject(
            "SELECT hit_count FROM vision_cache WHERE sha256 = ?", Integer.class, key);
        assertThat(count).isEqualTo(3);
    }

    @Test
    void emptyResultRoundtripsWithEmptyTextsArray() {
        String key = "it-cache-empty-result";
        visionCacheRepository.insert(key, VisionAnalysisResult.EMPTY);

        Optional<VisionAnalysisResult> stored = visionCacheRepository.findBySha256(key);
        assertThat(stored).isPresent();
        assertThat(stored.get().texts()).isEmpty();
        assertThat(stored.get().verdict()).isEqualTo(SafeSearchVerdict.ALLOW);
        assertThat(stored.get().hasPii()).isFalse();
    }
}
