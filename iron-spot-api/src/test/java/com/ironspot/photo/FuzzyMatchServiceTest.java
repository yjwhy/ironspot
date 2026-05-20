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
            new MachineTemplateSummary(highRowId, "Panatta", "High Row", ""),
            new MachineTemplateSummary(lowRowId, "Panatta", "Low Row", "")
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
            new MachineTemplateSummary(someId, "Panatta", "High Row", "")
        ));

        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(
            List.of("WATER", "BOTTLE")
        );

        assertThat(results).isEmpty();
    }

    @Test
    void findTemplateIdsReturnsEmptyWhenMachineNameNull() {
        List<UUID> ids = fuzzyMatchService.findTemplateIds(null, null, null);
        assertThat(ids).isEmpty();
    }

    @Test
    void findTemplateIdsMatchesNameOnlyIgnoringBrand() {
        UUID panattaHighRow = UUID.randomUUID();
        UUID cybexHighRow = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(panattaHighRow, "Panatta", "High Row", ""),
            new MachineTemplateSummary(cybexHighRow, "Cybex", "High Row", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", null, null);

        assertThat(ids).containsExactlyInAnyOrder(panattaHighRow, cybexHighRow);
    }

    @Test
    void findTemplateIdsLongBrandNameDoesNotDragJaccardBelowThreshold() {
        UUID id = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(id, "Hammer Strength Plate Loaded International", "Row", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("Row", null, null);

        assertThat(ids).containsExactly(id);
    }

    @Test
    void findTemplateIdsHonoursBrandPreFilter() {
        UUID panattaId = UUID.randomUUID();
        UUID onlyPanattaHighRow = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(panattaId, null)).thenReturn(List.of(
            new MachineTemplateSummary(onlyPanattaHighRow, "Panatta", "High Row", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", panattaId, null);

        assertThat(ids).containsExactly(onlyPanattaHighRow);
    }

    @Test
    void findTemplateIdsReturnsEmptyWhenFuzzyBelowThreshold() {
        UUID legPressId = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(legPressId, "Cybex", "Leg Press", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", null, null);

        assertThat(ids).isEmpty();
    }

    @Test
    void findTemplateIdsReturnsAllNameVariantsAboveThreshold() {
        UUID highRowLite = UUID.randomUUID();
        UUID highRowPro = UUID.randomUUID();
        UUID treadmill = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(highRowLite, "Panatta", "High Row Lite", ""),
            new MachineTemplateSummary(highRowPro, "Panatta", "Pro High Row", ""),
            new MachineTemplateSummary(treadmill, "Cybex", "Treadmill", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", null, null);

        assertThat(ids).containsExactlyInAnyOrder(highRowLite, highRowPro);
    }
}
