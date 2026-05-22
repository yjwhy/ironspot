package com.ironspot.brand;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 5 item 24 slice (a): exercises the bilingual fuzzy resolver on the
 * 3-brand init-test-db seed (Panatta / Life Fitness / Hammer Strength).
 * The 24-brand prod catalog is checked at runtime by the V11 migration's
 * deterministic UPDATEs — IT only needs to prove the resolver's three
 * stages (exact, whitespace-stripped, Levenshtein fallback) work end-to-end
 * and don't collide on overlapping names.
 */
@SpringBootTest
class BrandFuzzyResolverIT extends IntegrationTestBase {

    private static final UUID PANATTA_ID = UUID.fromString("b0000001-0000-0000-0000-000000000001");
    private static final UUID LIFE_FITNESS_ID = UUID.fromString("b0000002-0000-0000-0000-000000000002");
    private static final UUID HAMMER_STRENGTH_ID = UUID.fromString("b1000003-0000-0000-0000-000000000003");

    @Autowired
    private BrandRepository brandRepository;

    @Test
    void resolvesEnglishCanonicalExact() {
        assertThat(brandRepository.findIdByNameOrKoFuzzy("Panatta"))
            .contains(PANATTA_ID);
    }

    @Test
    void resolvesEnglishCaseInsensitive() {
        assertThat(brandRepository.findIdByNameOrKoFuzzy("panatta"))
            .contains(PANATTA_ID);
        assertThat(brandRepository.findIdByNameOrKoFuzzy("HAMMER STRENGTH"))
            .contains(HAMMER_STRENGTH_ID);
    }

    @Test
    void resolvesKoreanExact() {
        assertThat(brandRepository.findIdByNameOrKoFuzzy("파나타"))
            .contains(PANATTA_ID);
        assertThat(brandRepository.findIdByNameOrKoFuzzy("라이프 피트니스"))
            .contains(LIFE_FITNESS_ID);
    }

    @Test
    void resolvesKoreanWhitespaceVariant() {
        // User types without the canonical space — should still match
        // "해머 스트렝스" via the whitespace-stripped stage.
        assertThat(brandRepository.findIdByNameOrKoFuzzy("해머스트렝스"))
            .contains(HAMMER_STRENGTH_ID);
        assertThat(brandRepository.findIdByNameOrKoFuzzy("라이프피트니스"))
            .contains(LIFE_FITNESS_ID);
    }

    @Test
    void resolvesEnglishTypoViaLevenshtein() {
        // Single-character drop should still beat the 0.6 threshold for
        // brands of this length. "Panata" vs "PANATTA" → distance 1, max 7
        // → similarity ≈ 0.857.
        assertThat(brandRepository.findIdByNameOrKoFuzzy("Panata"))
            .contains(PANATTA_ID);
    }

    @Test
    void returnsEmptyWhenNoBrandIsCloseEnough() {
        assertThat(brandRepository.findIdByNameOrKoFuzzy("CompletelyDifferent"))
            .isEqualTo(Optional.empty());
    }

    @Test
    void returnsEmptyForBlankInput() {
        assertThat(brandRepository.findIdByNameOrKoFuzzy("")).isEmpty();
        assertThat(brandRepository.findIdByNameOrKoFuzzy("   ")).isEmpty();
        assertThat(brandRepository.findIdByNameOrKoFuzzy(null)).isEmpty();
    }
}
