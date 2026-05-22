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
            new MachineTemplateSummary(highRowId, "Panatta", "", "High Row", ""),
            new MachineTemplateSummary(lowRowId, "Panatta", "", "Low Row", "")
        ));

        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(
            List.of("PANATTA", "HIGH", "ROW")
        );

        assertThat(results).isNotEmpty();
        assertThat(results.get(0).nameEn()).isEqualTo("High Row");
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
            new MachineTemplateSummary(someId, "Panatta", "", "High Row", "")
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
            new MachineTemplateSummary(panattaHighRow, "Panatta", "", "High Row", ""),
            new MachineTemplateSummary(cybexHighRow, "Cybex", "", "High Row", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", null, null);

        assertThat(ids).containsExactlyInAnyOrder(panattaHighRow, cybexHighRow);
    }

    @Test
    void findTemplateIdsLongBrandNameDoesNotDragJaccardBelowThreshold() {
        UUID id = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(id, "Hammer Strength Plate Loaded International", "", "Row", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("Row", null, null);

        assertThat(ids).containsExactly(id);
    }

    @Test
    void findTemplateIdsHonoursBrandPreFilter() {
        UUID panattaId = UUID.randomUUID();
        UUID onlyPanattaHighRow = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(panattaId, null)).thenReturn(List.of(
            new MachineTemplateSummary(onlyPanattaHighRow, "Panatta", "", "High Row", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", panattaId, null);

        assertThat(ids).containsExactly(onlyPanattaHighRow);
    }

    @Test
    void findTemplateIdsReturnsEmptyWhenFuzzyBelowThreshold() {
        UUID legPressId = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(legPressId, "Cybex", "", "Leg Press", "")
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
            new MachineTemplateSummary(highRowLite, "Panatta", "", "High Row Lite", ""),
            new MachineTemplateSummary(highRowPro, "Panatta", "", "Pro High Row", ""),
            new MachineTemplateSummary(treadmill, "Cybex", "", "Treadmill", "")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("High Row", null, null);

        assertThat(ids).containsExactlyInAnyOrder(highRowLite, highRowPro);
    }

    // -------------------------------------------------------------------------
    // Phase 5 item 18 (slice b): bilingual tokenisation
    // -------------------------------------------------------------------------

    @Test
    void findTemplateIdsMatchesKoreanAlias() {
        UUID latPullDown = UUID.randomUUID();
        UUID seatedRow = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(latPullDown, "Hammer Strength", "", "Lat Pull Down", "랫 풀다운"),
            new MachineTemplateSummary(seatedRow, "Hammer Strength", "", "Seated Row", "시티드로우")
        ));

        // User types the Korean alias verbatim — should match the Lat Pull Down
        // row (not Seated Row) even though the English column doesn't share any
        // token with the Korean input.
        List<UUID> ids = fuzzyMatchService.findTemplateIds("랫 풀다운", null, null);

        assertThat(ids).containsExactly(latPullDown);
    }

    @Test
    void findTemplateIdsMatchesEnglishAliasAgainstKoreanPrimary() {
        // Symmetric coverage: LLM canonicalises to English on NL search, so the
        // English form must still match templates whose Korean primary is set.
        UUID chestPress = UUID.randomUUID();

        when(templateRepository.findApprovedByOptionalFilters(null, null)).thenReturn(List.of(
            new MachineTemplateSummary(chestPress, "Panatta", "", "Chest Press", "체스트 프레스")
        ));

        List<UUID> ids = fuzzyMatchService.findTemplateIds("Chest Press", null, null);

        assertThat(ids).containsExactly(chestPress);
    }

    @Test
    void findMatchesIncludesKoreanTokensInOcrTarget() {
        // Korean labels on machine bodies are common in domestic gyms even when
        // the brand plate is English. OCR text mixing Korean + English should
        // still find a match when either column tokenises in.
        UUID latPullDown = UUID.randomUUID();

        when(templateRepository.findAllApproved()).thenReturn(List.of(
            new MachineTemplateSummary(latPullDown, "Hammer Strength", "", "Lat Pull Down", "랫 풀다운")
        ));

        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(
            List.of("HAMMER", "STRENGTH", "랫", "풀다운")
        );

        assertThat(results).isNotEmpty();
        assertThat(results.get(0).id()).isEqualTo(latPullDown);
        assertThat(results.get(0).score()).isGreaterThan(0.5);
    }

    @Test
    void findMatchesIncludesKoreanBrandLabelInOcrTarget() {
        // Phase 5 item 24: brand stickers in Korean ("해머 스트렝스") should
        // contribute to OCR matching. Template's own nameKo is intentionally
        // empty here so the match comes purely from brandNameKo participating
        // in bilingualTokens — proves the brand-Korean column was added to
        // the concat.
        UUID latPullDown = UUID.randomUUID();

        when(templateRepository.findAllApproved()).thenReturn(List.of(
            new MachineTemplateSummary(
                latPullDown, "Hammer Strength", "해머 스트렝스", "Lat Pull Down", "")
        ));

        List<MachineTemplateSuggestion> results = fuzzyMatchService.findMatches(
            List.of("해머", "스트렝스", "Lat", "Pull", "Down")
        );

        assertThat(results).isNotEmpty();
        assertThat(results.get(0).id()).isEqualTo(latPullDown);
    }
}
