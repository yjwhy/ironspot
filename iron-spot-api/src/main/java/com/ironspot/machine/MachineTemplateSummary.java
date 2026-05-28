package com.ironspot.machine;

import java.util.UUID;

/**
 * Lightweight machine template projection used by FuzzyMatchService + internal
 * resolvers. Carries both language variants for brand (item 24) and template
 * name (item 18) so the caller can tokenise any of the four forms without an
 * extra DB round trip; OCR matching tokenises all four together, NL search
 * resolves brand via {@link com.ironspot.brand.BrandRepository}'s bilingual
 * fuzzy resolver and template via Jaccard over the en/ko monolingual pair.
 *
 * <p>V27 / machine_series: {@code brandId} + {@code seriesId} let
 * FuzzyMatchService anchor a second narrowing step. Once a brand is
 * recognised in OCR, the service consults series of that brand and, if a
 * series name is also in the input ("Lexco Master Pro"), restricts
 * suggestions to templates whose {@code seriesId} matches. {@code seriesId}
 * is NULL for templates whose brand has no marketed line or that predate
 * series assignment. {@code brandId} is NULL only on legacy test fixtures
 * that don't carry it (see the 5-arg overload).
 */
public record MachineTemplateSummary(
    UUID id,
    UUID brandId,
    String brandName,
    String brandNameKo,
    String nameEn,
    String nameKo,
    UUID seriesId
) {
    /**
     * Backwards-compatible 5-arg constructor: caller does not know (or care
     * about) brand id or series id. Kept so the ~15 unit-test fixtures
     * pre-dating V27 compile unchanged with brandId + seriesId defaulted to
     * NULL. Production callers should prefer the canonical 7-arg constructor
     * and project both ids.
     */
    public MachineTemplateSummary(
        UUID id,
        String brandName,
        String brandNameKo,
        String nameEn,
        String nameKo
    ) {
        this(id, null, brandName, brandNameKo, nameEn, nameKo, null);
    }
}
