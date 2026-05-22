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

    private static final double THRESHOLD = 0.25;

    private final MachineTemplateRepository templateRepository;

    public List<MachineTemplateSuggestion> findMatches(List<String> ocrTexts) {
        if (ocrTexts.isEmpty()) return List.of();

        String normalizedInput = String.join(" ", ocrTexts).toLowerCase(Locale.ROOT);
        Set<String> inputTokens = meaningfulTokens(normalizedInput);

        return templateRepository.findAllApproved().stream()
            .map(t -> {
                // Phase 5 item 18: tokenise brandName + nameEn + nameKo together
                // so OCR text in either language can hit the same row. Brand
                // names stay English per the locked Korean labelling decision.
                Set<String> targetTokens = bilingualTokens(t);
                double score = jaccardSimilarity(inputTokens, targetTokens);
                return new MachineTemplateSuggestion(
                    t.id(), t.brandName(), t.nameEn(), t.nameKo(), score);
            })
            .filter(s -> s.score() > THRESHOLD)
            .sorted(Comparator.comparing(MachineTemplateSuggestion::score).reversed())
            .limit(3)
            .toList();
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
            .filter(t -> bestMonolingualScore(input, t) > THRESHOLD)
            .map(MachineTemplateSummary::id)
            .toList();
    }

    private Set<String> bilingualTokens(MachineTemplateSummary t) {
        // Concatenate brand (en + ko) + template name (en + ko) into one
        // lowercase token set. Used by findMatches (OCR target) where the
        // brand plate is part of the user's visual context: a sticker
        // reading "해머 스트렝스" or "Hammer Strength" should both boost
        // whole-row matches without hurting partial ones. Item 24 added
        // brandNameKo to the concat — item 18 had nameKo for the template
        // already; this brings brand parity.
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
    // one inflates the Jaccard union, pushing real matches below THRESHOLD.
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
