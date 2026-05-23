package com.ironspot.photo;

import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.machine.MachineTemplateSummary;
import com.ironspot.photo.dto.MachineTemplateSuggestion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FuzzyMatchService {

    // Precision threshold for template-name matching once the candidate set
    // has already been narrowed by brand recognition. Score is
    // intersection(input, template-name tokens) / |template-name tokens|, so
    // 0.2 means the user's photo shared at least one-fifth of the template's
    // name tokens. Brand tokens are excluded from this calculation: brand
    // anchoring already committed to the brand, so the remaining score
    // should reflect machine-name confidence only.
    private static final double TEMPLATE_NAME_THRESHOLD = 0.2;

    // Fallback Jaccard threshold for the "no catalog brand recognised in
    // OCR" path. This is the legacy behaviour — score against the full
    // bilingual concat — and keeps the previous cutoff so degraded photos
    // (worn plate, harsh lighting) still surface plausible suggestions
    // when the brand stamp is missing.
    private static final double FALLBACK_JACCARD_THRESHOLD = 0.25;

    private final MachineTemplateRepository templateRepository;

    public List<MachineTemplateSuggestion> findMatches(List<String> ocrTexts) {
        if (ocrTexts.isEmpty()) return List.of();

        String normalizedInput = String.join(" ", ocrTexts).toLowerCase(Locale.ROOT);
        Set<String> inputTokens = meaningfulTokens(normalizedInput);

        List<MachineTemplateSummary> approved = templateRepository.findAllApproved();
        Set<String> matchedBrandKeys = identifyMatchedBrandKeys(inputTokens, approved);

        if (matchedBrandKeys.isEmpty()) {
            return scoreByBilingualJaccard(inputTokens, approved);
        }
        return scoreByTemplateNamePrecision(inputTokens, approved, matchedBrandKeys);
    }

    public List<UUID> findTemplateIds(String machineName, UUID brandId, UUID categoryId) {
        if (machineName == null || machineName.isBlank()) return List.of();

        Set<String> input = tokenize(machineName.toLowerCase(Locale.ROOT));

        return templateRepository.findApprovedByOptionalFilters(brandId, categoryId).stream()
            // Phase 5 item 18: a query token set passes when it overlaps EITHER
            // the English or the Korean column above THRESHOLD. We score the
            // two columns independently rather than unioning their tokens so a
            // partial English match isn't diluted by an unrelated Korean form
            // (and vice versa). The richer the catalog, the more divergent the
            // two forms can be — keeping them separate preserves precision.
            .filter(t -> bestMonolingualScore(input, t) > FALLBACK_JACCARD_THRESHOLD)
            .map(MachineTemplateSummary::id)
            .toList();
    }

    // -------------------------------------------------------------------------
    // Brand-anchored scoring (primary path)
    //
    // Real-world gym photos pick up an unbounded amount of background text:
    // Mac/IDE screens behind the user, apparel logos on bystanders, posters,
    // mirror reflections, weight-plate markings. Token-level Jaccard against
    // the full bilingual concat lets every one of those noise tokens
    // contribute to the union, dragging real matches below threshold and
    // occasionally surfacing off-brand templates whose name tokens happen to
    // overlap (e.g. every brand's "Leg Extension").
    //
    // Brand anchoring breaks that: if the user's OCR contains all tokens of a
    // catalog brand name (English or Korean), candidates are restricted to
    // that brand's templates. Background noise tokens that aren't catalog
    // brands (Nike, Bookmarks, DELL, ...) are simply ignored because they
    // never match any catalog brand. Scoring within the matched-brand set
    // then uses a precision-style metric — intersection / template-name
    // tokens — so the same input length stops penalising legit matches.
    // -------------------------------------------------------------------------

    private List<MachineTemplateSuggestion> scoreByTemplateNamePrecision(
        Set<String> inputTokens,
        List<MachineTemplateSummary> approved,
        Set<String> matchedBrandKeys
    ) {
        return approved.stream()
            .filter(t -> matchedBrandKeys.contains(brandKey(t)))
            .map(t -> {
                Set<String> templateNameTokens = templateNameTokens(t);
                double score = precision(inputTokens, templateNameTokens);
                return new MachineTemplateSuggestion(
                    t.id(), t.brandName(), t.nameEn(), t.nameKo(), score);
            })
            .filter(s -> s.score() > TEMPLATE_NAME_THRESHOLD)
            .sorted(Comparator.comparing(MachineTemplateSuggestion::score).reversed())
            .limit(3)
            .toList();
    }

    private List<MachineTemplateSuggestion> scoreByBilingualJaccard(
        Set<String> inputTokens,
        List<MachineTemplateSummary> approved
    ) {
        return approved.stream()
            .map(t -> {
                Set<String> targetTokens = bilingualTokens(t);
                double score = jaccardSimilarity(inputTokens, targetTokens);
                return new MachineTemplateSuggestion(
                    t.id(), t.brandName(), t.nameEn(), t.nameKo(), score);
            })
            .filter(s -> s.score() > FALLBACK_JACCARD_THRESHOLD)
            .sorted(Comparator.comparing(MachineTemplateSuggestion::score).reversed())
            .limit(3)
            .toList();
    }

    // Returns the set of brand keys (lowercase "en|ko") whose name tokens are
    // wholly present in the OCR input. A brand matches if EITHER its English
    // name tokens OR its Korean name tokens all appear in the input. The
    // all-tokens-required rule keeps "Hammer" or "Strength" alone from
    // triggering a Hammer Strength match (partial token match would let
    // common English words like "Strong" leak in via tokenisation noise).
    private Set<String> identifyMatchedBrandKeys(
        Set<String> inputTokens,
        List<MachineTemplateSummary> approved
    ) {
        Set<String> matched = new HashSet<>();
        Set<String> seen = new HashSet<>();
        for (MachineTemplateSummary t : approved) {
            String key = brandKey(t);
            if (!seen.add(key)) continue;
            if (brandTokensSubsetOfInput(inputTokens, t.brandName())
                || brandTokensSubsetOfInput(inputTokens, t.brandNameKo())) {
                matched.add(key);
            }
        }
        return matched;
    }

    private boolean brandTokensSubsetOfInput(Set<String> inputTokens, String brandName) {
        if (brandName == null || brandName.isBlank()) return false;
        Set<String> brandTokens = tokenize(brandName.toLowerCase(Locale.ROOT));
        if (brandTokens.isEmpty()) return false;
        return brandTokens.stream().allMatch(inputTokens::contains);
    }

    private String brandKey(MachineTemplateSummary t) {
        String en = t.brandName() == null ? "" : t.brandName().toLowerCase(Locale.ROOT);
        String ko = t.brandNameKo() == null ? "" : t.brandNameKo().toLowerCase(Locale.ROOT);
        return en + "|" + ko;
    }

    private Set<String> templateNameTokens(MachineTemplateSummary t) {
        String en = t.nameEn() == null ? "" : t.nameEn();
        String ko = t.nameKo() == null ? "" : t.nameKo();
        return tokenize((en + " " + ko).toLowerCase(Locale.ROOT));
    }

    // Precision = how much of the template name the OCR covered. Brand tokens
    // are NOT in the denominator because brand confirmation is a prerequisite
    // of this code path. Score range [0, 1]; the limit is reached when the
    // user typed the exact template name verbatim.
    private double precision(Set<String> input, Set<String> templateNameTokens) {
        if (templateNameTokens.isEmpty()) return 0;
        long shared = templateNameTokens.stream().filter(input::contains).count();
        return (double) shared / templateNameTokens.size();
    }

    private Set<String> bilingualTokens(MachineTemplateSummary t) {
        // Concatenate brand (en + ko) + template name (en + ko) into one
        // lowercase token set. Used by the fallback Jaccard path when no
        // catalog brand could be recognised in OCR — the score then reflects
        // overlap across the whole bilingual surface.
        String concat = (
            t.brandName() + " " + t.brandNameKo() + " " + t.nameEn() + " " + t.nameKo()
        ).toLowerCase(Locale.ROOT);
        return tokenize(concat);
    }

    private double bestMonolingualScore(Set<String> input, MachineTemplateSummary t) {
        double enScore = jaccardSimilarity(input, tokenize(t.nameEn().toLowerCase(Locale.ROOT)));
        if (t.nameKo() == null || t.nameKo().isBlank()) return enScore;
        double koScore = jaccardSimilarity(input, tokenize(t.nameKo().toLowerCase(Locale.ROOT)));
        return Math.max(enScore, koScore);
    }

    private Set<String> tokenize(String text) {
        return new HashSet<>(Arrays.asList(text.split("\\s+")));
    }

    // OCR text on a real gym plate is mostly model numbers, weight units, URLs
    // and stray punctuation. Those tokens never match a catalog row but each
    // one inflates the union, so drop them before any scoring runs.
    // Target-side tokens (curated catalog text) are not filtered — they are
    // clean by construction and removing tokens there would lose precision.
    private Set<String> meaningfulTokens(String text) {
        Set<String> raw = tokenize(text);
        Set<String> kept = new HashSet<>();
        for (String token : raw) {
            if (isMeaningfulToken(token)) kept.add(token);
        }
        return kept;
    }

    private boolean isMeaningfulToken(String token) {
        if (token.isBlank()) return false;
        // Single ASCII chars are always noise on a gym plate ("Q", "D", ".",
        // "0"). A single Hangul char can carry meaning (e.g. "랫" / "팻"), so
        // length-1 Hangul tokens stay in.
        if (token.length() == 1 && !isHangul(token.charAt(0))) return false;
        if (token.contains("://") || token.startsWith("www.")
            || token.endsWith(".com") || token.endsWith(".net")
            || token.endsWith(".org") || token.endsWith(".kr")
            || token.endsWith(".io")) return false;
        for (int i = 0; i < token.length(); i++) {
            if (Character.isDigit(token.charAt(i))) return false;
        }
        for (int i = 0; i < token.length(); i++) {
            char c = token.charAt(i);
            if (Character.isLetter(c)) return true;
        }
        return false;
    }

    private boolean isHangul(char c) {
        return Character.UnicodeScript.of(c) == Character.UnicodeScript.HANGUL;
    }

    private double jaccardSimilarity(Set<String> a, Set<String> b) {
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
    }
}
