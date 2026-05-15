package com.ironspot.search;

import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class InterpretationFormatterTest {

    private final InterpretationFormatter formatter = new InterpretationFormatter();

    @Test
    void currentLocationNoFilters() {
        SearchDsl dsl = new SearchDsl(new Location.Current(1.0), List.of(), null);

        assertThat(formatter.format(dsl)).isEqualTo("내 위치 1km 이내 헬스장");
    }

    @Test
    void namedPlaceNoFilters() {
        SearchDsl dsl = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0),
            List.of(),
            null
        );

        assertThat(formatter.format(dsl)).isEqualTo("강남역 1km 이내 헬스장");
    }

    @Test
    void singleEachFilterWithBrandAndMachineName() {
        SearchDsl dsl = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0),
            List.of(new MachineFilter("Panatta", "High Row", null, 3, SearchScope.EACH)),
            null
        );

        assertThat(formatter.format(dsl))
            .isEqualTo("강남역 1km 이내 Panatta High Row 3개씩 보유한 헬스장");
    }

    @Test
    void multipleEachFiltersJoinedByComma() {
        SearchDsl dsl = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0),
            List.of(
                new MachineFilter("Panatta", "High Row", null, 3, SearchScope.EACH),
                new MachineFilter("Prime", null, null, 3, SearchScope.EACH)
            ),
            null
        );

        assertThat(formatter.format(dsl))
            .isEqualTo("강남역 1km 이내 Panatta High Row 3개씩, Prime 3개씩 보유한 헬스장");
    }

    @Test
    void combinedFiltersJoinedByOr() {
        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(
                new MachineFilter("Panatta", null, null, 5, SearchScope.COMBINED),
                new MachineFilter("Technogym", null, null, 5, SearchScope.COMBINED)
            ),
            null
        );

        assertThat(formatter.format(dsl))
            .isEqualTo("내 위치 1km 이내 Panatta 5개 합쳐서 또는 Technogym 5개 합쳐서 보유한 헬스장");
    }

    @Test
    void categoryOnlyFilter() {
        SearchDsl dsl = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter(null, null, "Back", 3, SearchScope.EACH)),
            null
        );

        assertThat(formatter.format(dsl))
            .isEqualTo("내 위치 1km 이내 Back 3개씩 보유한 헬스장");
    }

    @Test
    void fractionalRadiusFormatsWithDecimal() {
        SearchDsl dsl = new SearchDsl(new Location.Current(2.5), List.of(), null);

        assertThat(formatter.format(dsl)).isEqualTo("내 위치 2.5km 이내 헬스장");
    }
}
