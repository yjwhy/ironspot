package com.ironspot.machine;

import java.util.UUID;

/**
 * Lightweight machine template projection used by FuzzyMatchService + internal
 * resolvers. Carries both language variants for brand (item 24) and template
 * name (item 18) so the caller can tokenise any of the four forms without an
 * extra DB round trip; OCR matching tokenises all four together, NL search
 * resolves brand via {@link com.ironspot.brand.BrandRepository}'s bilingual
 * fuzzy resolver and template via Jaccard over the en/ko monolingual pair.
 */
public record MachineTemplateSummary(
    UUID id,
    String brandName,
    String brandNameKo,
    String nameEn,
    String nameKo
) {}
