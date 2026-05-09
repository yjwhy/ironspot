package com.ironspot.photo;

import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.photo.dto.MachineTemplateSuggestion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class FuzzyMatchService {

    private final MachineTemplateRepository templateRepository;

    public List<MachineTemplateSuggestion> findMatches(List<String> ocrTexts) {
        if (ocrTexts.isEmpty()) return List.of();

        String normalizedInput = String.join(" ", ocrTexts).toLowerCase();
        Set<String> inputTokens = tokenize(normalizedInput);

        return templateRepository.findAllApproved().stream()
            .map(t -> {
                String target = (t.brandName() + " " + t.name()).toLowerCase();
                double score = jaccardSimilarity(inputTokens, tokenize(target));
                return new MachineTemplateSuggestion(t.id(), t.brandName(), t.name(), score);
            })
            .filter(s -> s.score() > 0.25)
            .sorted(Comparator.comparing(MachineTemplateSuggestion::score).reversed())
            .limit(3)
            .toList();
    }

    private Set<String> tokenize(String text) {
        return new HashSet<>(Arrays.asList(text.split("\\s+")));
    }

    private double jaccardSimilarity(Set<String> a, Set<String> b) {
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return union.isEmpty() ? 0 : (double) intersection.size() / union.size();
    }
}
