package com.ironspot.photo;

import com.ironspot.machine.MachineTemplateSummary;
import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.photo.dto.MachineTemplateSuggestion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FuzzyMatchServiceTest {

    @Mock
    private MachineTemplateRepository templateRepository;

    @InjectMocks
    private FuzzyMatchService fuzzyMatchService;

    @Test
    void matchesPanattaHighRowFromOcr() {
        UUID highRowId = UUID.randomUUID();
        UUID lowRowId = UUID.randomUUID();

        when(templateRepository.findAllApproved()).thenReturn(List.of(
            new MachineTemplateSummary(highRowId, "Panatta", "High Row"),
            new MachineTemplateSummary(lowRowId, "Panatta", "Low Row")
        ));

        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(
            List.of("PANATTA", "HIGH", "ROW")
        );

        assertThat(results).isNotEmpty();
        assertThat(results.get(0).name()).isEqualTo("High Row");
        assertThat(results.get(0).score()).isGreaterThan(0.5);
    }

    @Test
    void returnsEmptyListWhenOcrTextsAreEmpty() {
        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(List.of());

        assertThat(results).isEmpty();
    }

    @Test
    void filtersOutLowScoreMatches() {
        UUID someId = UUID.randomUUID();

        when(templateRepository.findAllApproved()).thenReturn(List.of(
            new MachineTemplateSummary(someId, "Panatta", "High Row")
        ));

        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(
            List.of("WATER", "BOTTLE")
        );

        assertThat(results).isEmpty();
    }
}
