package com.ironspot.search;

import com.ironspot.brand.BrandRepository;
import com.ironspot.category.CategoryRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.photo.FuzzyMatchService;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DslValidatorTest {

    @Mock
    private BrandRepository brandRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FuzzyMatchService fuzzyMatchService;

    @InjectMocks
    private DslValidator validator;

    @Test
    void validatesEmptyFilterList() {
        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(),
            null
        );

        ValidatedSearch result = validator.validate(dsl);

        assertThat(result.filters()).isEmpty();
        assertThat(result.location()).isEqualTo(new Location.Current(1.0));
    }

    @Test
    void resolvesBrandIgnoringCase() {
        UUID panattaId = UUID.randomUUID();
        when(brandRepository.findIdByNameIgnoreCase("panatta")).thenReturn(Optional.of(panattaId));

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter("panatta", null, null, 1, SearchScope.EACH)),
            null
        );

        ValidatedSearch result = validator.validate(dsl);

        assertThat(result.filters()).hasSize(1);
        assertThat(result.filters().get(0).brandId()).isEqualTo(panattaId);
        assertThat(result.filters().get(0).categoryId()).isNull();
        assertThat(result.filters().get(0).templateIds()).isEmpty();
    }

    @Test
    void throwsWhenBrandUnknown() {
        when(brandRepository.findIdByNameIgnoreCase("UnknownBrand")).thenReturn(Optional.empty());

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter("UnknownBrand", null, null, 1, SearchScope.EACH)),
            null
        );

        assertThatThrownBy(() -> validator.validate(dsl))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("UnknownBrand");
    }

    @Test
    void resolvesCategoryIgnoringCase() {
        UUID backId = UUID.randomUUID();
        when(categoryRepository.findIdByNameIgnoreCase("back")).thenReturn(Optional.of(backId));

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter(null, null, "back", 3, SearchScope.EACH)),
            null
        );

        ValidatedSearch result = validator.validate(dsl);

        assertThat(result.filters().get(0).categoryId()).isEqualTo(backId);
    }

    @Test
    void throwsWhenCategoryUnknown() {
        when(categoryRepository.findIdByNameIgnoreCase("Unknown")).thenReturn(Optional.empty());

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter(null, null, "Unknown", 1, SearchScope.EACH)),
            null
        );

        assertThatThrownBy(() -> validator.validate(dsl))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Unknown");
    }

    @Test
    void resolvesMachineNameToTemplateIds() {
        UUID panattaId = UUID.randomUUID();
        UUID templateA = UUID.randomUUID();
        UUID templateB = UUID.randomUUID();
        when(brandRepository.findIdByNameIgnoreCase("Panatta")).thenReturn(Optional.of(panattaId));
        when(fuzzyMatchService.findTemplateIds("High Row", panattaId, null))
            .thenReturn(List.of(templateA, templateB));

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter("Panatta", "High Row", null, 2, SearchScope.EACH)),
            null
        );

        ValidatedSearch result = validator.validate(dsl);

        assertThat(result.filters().get(0).templateIds())
            .containsExactlyInAnyOrder(templateA, templateB);
        assertThat(result.filters().get(0).brandId()).isEqualTo(panattaId);
    }

    @Test
    void throwsWhenMachineNameFuzzyReturnsNothing() {
        when(fuzzyMatchService.findTemplateIds("UnknownMachine", null, null))
            .thenReturn(List.of());

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter(null, "UnknownMachine", null, 1, SearchScope.EACH)),
            null
        );

        assertThatThrownBy(() -> validator.validate(dsl))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("UnknownMachine");
    }

    @Test
    void combinedScopeRequiresAllFiltersToShareMinCount() {
        UUID panattaId = UUID.randomUUID();
        UUID technogymId = UUID.randomUUID();
        when(brandRepository.findIdByNameIgnoreCase("Panatta")).thenReturn(Optional.of(panattaId));
        when(brandRepository.findIdByNameIgnoreCase("Technogym")).thenReturn(Optional.of(technogymId));

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(
                new MachineFilter("Panatta", null, null, 5, SearchScope.COMBINED),
                new MachineFilter("Technogym", null, null, 3, SearchScope.COMBINED)
            ),
            null
        );

        assertThatThrownBy(() -> validator.validate(dsl))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("다시 시도");
    }

    @Test
    void combinedScopeWithConsistentMinCountSucceeds() {
        UUID panattaId = UUID.randomUUID();
        UUID technogymId = UUID.randomUUID();
        when(brandRepository.findIdByNameIgnoreCase("Panatta")).thenReturn(Optional.of(panattaId));
        when(brandRepository.findIdByNameIgnoreCase("Technogym")).thenReturn(Optional.of(technogymId));

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(
                new MachineFilter("Panatta", null, null, 5, SearchScope.COMBINED),
                new MachineFilter("Technogym", null, null, 5, SearchScope.COMBINED)
            ),
            null
        );

        ValidatedSearch result = validator.validate(dsl);

        assertThat(result.filters()).hasSize(2);
        assertThat(result.filters().get(0).scope()).isEqualTo(SearchScope.COMBINED);
    }

    @Test
    void singleFilterEachScopeNeedsNoCombinedInvariant() {
        UUID panattaId = UUID.randomUUID();
        when(brandRepository.findIdByNameIgnoreCase("Panatta")).thenReturn(Optional.of(panattaId));

        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter("Panatta", null, null, 1, SearchScope.EACH)),
            null
        );

        ValidatedSearch result = validator.validate(dsl);

        assertThat(result.filters().get(0).scope()).isEqualTo(SearchScope.EACH);
    }
}
