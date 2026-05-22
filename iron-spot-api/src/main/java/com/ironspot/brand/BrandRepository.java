package com.ironspot.brand;

import com.ironspot.brand.dto.BrandResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.BRANDS;

@Repository
@RequiredArgsConstructor
public class BrandRepository {

    /**
     * Phase 5 item 24: bilingual fuzzy resolver threshold for the
     * Levenshtein-normalised similarity fallback. The catalog is 24 rows so
     * a generous threshold is safe — collisions inside the launch catalog
     * are checked in BrandFuzzyResolverIT. Tuned higher than the OCR
     * threshold (FuzzyMatchService.THRESHOLD = 0.25) because brand names
     * are short, so single-character differences move the score sharply.
     */
    private static final double FUZZY_THRESHOLD = 0.6;

    private final DSLContext dsl;

    public List<BrandResponse> findAll() {
        return dsl.select(BRANDS.ID, BRANDS.NAME, BRANDS.NAME_KO)
            .from(BRANDS)
            .orderBy(BRANDS.NAME)
            .fetch(r -> new BrandResponse(
                r.get(BRANDS.ID),
                r.get(BRANDS.NAME),
                r.get(BRANDS.NAME_KO)));
    }

    /**
     * Phase 5 item 24: bilingual brand resolver. Tries three stages over
     * the 24-row catalog (microsecond cost):
     *   1) exact, case-insensitive on either column
     *   2) whitespace-stripped exact (catches "해머스트렝스" → "해머 스트렝스")
     *   3) Levenshtein-normalised similarity ≥ {@link #FUZZY_THRESHOLD}
     *      on either column's stripped form (catches typos)
     *
     * Returns the best brand id when a match is found. The fuzzy fallback
     * is a safety net for cases where the NL search LLM passes the user's
     * literal token through without normalisation (search-dsl.md rule:
     * "Never reject an unknown brand — pass it through"). Wire-format
     * unchanged; only internal resolution expands.
     */
    public Optional<UUID> findIdByNameOrKoFuzzy(String input) {
        if (input == null || input.isBlank()) return Optional.empty();

        String upper = input.trim().toUpperCase(Locale.ROOT);
        String stripped = upper.replaceAll("\\s+", "");

        List<BrandRow> all = dsl.select(BRANDS.ID, BRANDS.NAME, BRANDS.NAME_KO)
            .from(BRANDS)
            .fetch(r -> new BrandRow(
                r.get(BRANDS.ID),
                r.get(BRANDS.NAME).toUpperCase(Locale.ROOT),
                r.get(BRANDS.NAME_KO).toUpperCase(Locale.ROOT)));

        for (BrandRow b : all) {
            if (b.name.equals(upper) || b.nameKo.equals(upper)) return Optional.of(b.id);
        }

        for (BrandRow b : all) {
            if (b.name.replaceAll("\\s+", "").equals(stripped)
                || b.nameKo.replaceAll("\\s+", "").equals(stripped)) return Optional.of(b.id);
        }

        UUID bestId = null;
        double bestScore = FUZZY_THRESHOLD;
        for (BrandRow b : all) {
            double score = Math.max(
                similarity(stripped, b.name.replaceAll("\\s+", "")),
                similarity(stripped, b.nameKo.replaceAll("\\s+", "")));
            if (score > bestScore) {
                bestScore = score;
                bestId = b.id;
            }
        }
        return Optional.ofNullable(bestId);
    }

    /**
     * Phase 5 item 11 sub-task 4: admin-created brand from the promote
     * action's {@code newBrandAndTemplate} kind. Returns the new id so the
     * caller can chain into MachineTemplateRepository.create. The unique
     * constraint on {@code brands.name} bubbles up as a
     * {@link org.springframework.dao.DuplicateKeyException} for the service
     * to map to 409.
     *
     * <p>Phase 5 item 24 slice (a) note: V11 made {@code name_ko} NOT NULL,
     * so this single-arg variant temporarily fills it with the English name
     * to satisfy the constraint. Slice (b) lands the wire-level
     * {@code newBrandNameKo} field on {@code PromoteContributionRequest} and
     * updates this call to pass the admin-typed Korean string through.
     */
    public UUID create(String name) {
        return dsl.insertInto(BRANDS)
            .set(BRANDS.NAME, name)
            .set(BRANDS.NAME_KO, name)
            .returning(BRANDS.ID)
            .fetchOne()
            .get(BRANDS.ID);
    }

    /**
     * Phase 5 item 11 sub-task 4: existence check for the brandId field on
     * {@code PromoteContributionRequest.NewTemplate}. The service returns
     * 404 when the picker hands back a stale brand id.
     */
    public boolean existsById(UUID brandId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(BRANDS)
                .where(BRANDS.ID.eq(brandId))
        );
    }

    private record BrandRow(UUID id, String name, String nameKo) {}

    private static double similarity(String a, String b) {
        int maxLen = Math.max(a.length(), b.length());
        if (maxLen == 0) return 1.0;
        return 1.0 - ((double) levenshtein(a, b) / maxLen);
    }

    /**
     * Iterative two-row Levenshtein distance. O(n*m) time, O(min(n,m))
     * space. Inlined to avoid pulling Apache Commons Text just for this
     * 20-line helper used only by the brand resolver.
     */
    private static int levenshtein(String a, String b) {
        int n = a.length();
        int m = b.length();
        if (n == 0) return m;
        if (m == 0) return n;

        int[] prev = new int[m + 1];
        int[] curr = new int[m + 1];
        for (int j = 0; j <= m; j++) prev[j] = j;

        for (int i = 1; i <= n; i++) {
            curr[0] = i;
            for (int j = 1; j <= m; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(
                    Math.min(curr[j - 1] + 1, prev[j] + 1),
                    prev[j - 1] + cost);
            }
            int[] swap = prev;
            prev = curr;
            curr = swap;
        }
        return prev[m];
    }
}
