package com.ironspot.search;

import java.text.Normalizer;

/**
 * NL search query normalisation for the nl_search_log analytics grouping key.
 *
 * <p>Rules locked by grill on 2026-05-18 (see
 * {@code docs/plans/phase-4/implementation.md} "NL search query log infra
 * plan", Q6). The normalised form should mirror what a realistic production
 * cache key would do — light enough to preserve Korean semantics, aggressive
 * enough to bucket emphasis variants together.
 *
 * <p>Rules applied (in order):
 * <ol>
 *   <li>Unicode NFC normalisation — Hangul 자모/조합 unified, otherwise
 *       different code points for the same visible text would count as
 *       different queries.</li>
 *   <li>Lowercase — only affects the English subset of mixed-language
 *       queries; Korean has no case.</li>
 *   <li>Collapse whitespace runs to a single space.</li>
 *   <li>Drop trailing punctuation and Korean filler ({@code .?!~ㅋㅎ}),
 *       which conveys casualness not search intent.</li>
 *   <li>Trim leading/trailing whitespace.</li>
 * </ol>
 *
 * <p>Explicitly <strong>not</strong> applied (per memory
 * {@code feedback_korean_natural_language}):
 * <ul>
 *   <li>조사 stripping — would distort Korean semantics and require a
 *       morphological analyser dependency.</li>
 *   <li>Synonym mapping — needs curation, premature pre-launch.</li>
 *   <li>Emoji stripping — rare in search input, accept as noise.</li>
 * </ul>
 */
public final class Normaliser {

    private Normaliser() {}

    public static String normalise(String raw) {
        if (raw == null) return "";
        return Normalizer.normalize(raw, Normalizer.Form.NFC)
            .toLowerCase()
            .replaceAll("\\s+", " ")
            .replaceAll("[.?!~ㅋㅎ]+$", "")
            .trim();
    }
}
