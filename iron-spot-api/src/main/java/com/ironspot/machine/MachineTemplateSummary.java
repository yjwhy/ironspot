package com.ironspot.machine;

import java.util.UUID;

/**
 * Lightweight machine template projection used by FuzzyMatchService + internal
 * resolvers. Carries both language variants since item 18 (Phase 5) so the
 * caller can tokenise either side without an extra DB round trip; the picker
 * UI / OCR matching uses Korean primary, NL search canonicalises to English.
 */
public record MachineTemplateSummary(UUID id, String brandName, String nameEn, String nameKo) {}
