package com.ironspot.search.eval;

import com.ironspot.search.dsl.Coordinates;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SemanticMatcherTest {

    @Test
    void exactMatchPasses() {
        SearchDsl dsl = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0),
            List.of(new MachineFilter("Panatta", null, null, 3, SearchScope.EACH)),
            null);

        SemanticMatcher.MatchResult result = SemanticMatcher.match(dsl, dsl);

        assertThat(result.matches()).isTrue();
        assertThat(result.mismatchField()).isNull();
    }

    @Test
    void errorCodeMatchPasses() {
        SearchDsl expected = new SearchDsl(null, null, "gym search only");
        SearchDsl actual = new SearchDsl(null, null, "gym search only");

        assertThat(SemanticMatcher.match(expected, actual).matches()).isTrue();
    }

    @Test
    void errorCodeMismatchFailsOnErrorField() {
        SearchDsl expected = new SearchDsl(null, null, "gym search only");
        SearchDsl actual = new SearchDsl(null, null, "invalid input");

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).isEqualTo("error");
    }

    @Test
    void expectedNonErrorActualErrorFailsOnErrorField() {
        SearchDsl expected = new SearchDsl(new Location.Current(1.0), List.of(), null);
        SearchDsl actual = new SearchDsl(null, null, "gym search only");

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).isEqualTo("error");
    }

    @Test
    void locationTypeMismatchFails() {
        SearchDsl expected = new SearchDsl(new Location.Current(1.0), List.of(), null);
        SearchDsl actual = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0), List.of(), null);

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).isEqualTo("location.type");
    }

    @Test
    void radiusWithinTolerancePasses() {
        // 1.0 vs 1.15 → diff 0.15 < 0.2 tolerance
        SearchDsl expected = new SearchDsl(new Location.Current(1.0), List.of(), null);
        SearchDsl actual = new SearchDsl(new Location.Current(1.15), List.of(), null);

        assertThat(SemanticMatcher.match(expected, actual).matches()).isTrue();
    }

    @Test
    void radiusOutsideToleranceFails() {
        // 1.0 vs 1.25 → diff 0.25 > 0.2 tolerance
        SearchDsl expected = new SearchDsl(new Location.Current(1.0), List.of(), null);
        SearchDsl actual = new SearchDsl(new Location.Current(1.25), List.of(), null);

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).isEqualTo("location.radiusKm");
    }

    @Test
    void namedPlaceNameExactCaseSensitiveFails() {
        SearchDsl expected = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0), List.of(), null);
        SearchDsl actual = new SearchDsl(
            new Location.NamedPlace("강남", null, 1.0), List.of(), null);

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).isEqualTo("location.name");
    }

    @Test
    void coordinatesIgnored() {
        // expected has null coordinates (yaml omits), actual has filled (post-Naver) — should still pass
        SearchDsl expected = new SearchDsl(
            new Location.NamedPlace("강남역", null, 1.0), List.of(), null);
        SearchDsl actual = new SearchDsl(
            new Location.NamedPlace("강남역", new Coordinates(37.498, 127.027), 1.0),
            List.of(), null);

        assertThat(SemanticMatcher.match(expected, actual).matches()).isTrue();
    }

    @Test
    void brandCaseInsensitivePasses() {
        SearchDsl expected = filterDsl(new MachineFilter("Panatta", null, null, 1, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter("panatta", null, null, 1, SearchScope.EACH));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isTrue();
    }

    @Test
    void brandMismatchFails() {
        SearchDsl expected = filterDsl(new MachineFilter("Panatta", null, null, 1, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter("Cybex", null, null, 1, SearchScope.EACH));

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).startsWith("machineFilters[");
    }

    @Test
    void machineNameNormalizedPasses() {
        // expected "High Row" vs actual "high  row" (extra space, different case)
        SearchDsl expected = filterDsl(new MachineFilter(null, "High Row", null, 1, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter(null, "high  row", null, 1, SearchScope.EACH));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isTrue();
    }

    @Test
    void machineNameDifferentTextFails() {
        SearchDsl expected = filterDsl(new MachineFilter(null, "High Row", null, 1, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter(null, "Hi Row", null, 1, SearchScope.EACH));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isFalse();
    }

    @Test
    void categoryCaseSensitiveFails() {
        SearchDsl expected = filterDsl(new MachineFilter(null, null, "Chest", 1, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter(null, null, "chest", 1, SearchScope.EACH));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isFalse();
    }

    @Test
    void minCountMismatchFails() {
        SearchDsl expected = filterDsl(new MachineFilter("Panatta", null, null, 3, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter("Panatta", null, null, 5, SearchScope.EACH));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isFalse();
    }

    @Test
    void scopeMismatchFails() {
        SearchDsl expected = filterDsl(new MachineFilter("Panatta", null, null, 5, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter("Panatta", null, null, 5, SearchScope.COMBINED));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isFalse();
    }

    @Test
    void filtersSizeMismatchFails() {
        SearchDsl expected = new SearchDsl(
            new Location.Current(1.0),
            List.of(new MachineFilter("Panatta", null, null, 1, SearchScope.EACH)),
            null);
        SearchDsl actual = new SearchDsl(
            new Location.Current(1.0),
            List.of(
                new MachineFilter("Panatta", null, null, 1, SearchScope.EACH),
                new MachineFilter("Cybex", null, null, 1, SearchScope.EACH)),
            null);

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).isEqualTo("machineFilters.size");
    }

    @Test
    void filtersOrderAgnosticPasses() {
        MachineFilter a = new MachineFilter("Panatta", null, null, 1, SearchScope.EACH);
        MachineFilter b = new MachineFilter("Cybex", null, null, 2, SearchScope.EACH);
        SearchDsl expected = new SearchDsl(new Location.Current(1.0), List.of(a, b), null);
        SearchDsl actual = new SearchDsl(new Location.Current(1.0), List.of(b, a), null);

        assertThat(SemanticMatcher.match(expected, actual).matches()).isTrue();
    }

    @Test
    void filterMissingFromActualFails() {
        // expected has a Panatta filter, actual has Cybex+Matrix — size matches but Panatta isn't there
        SearchDsl expected = new SearchDsl(
            new Location.Current(1.0),
            List.of(
                new MachineFilter("Panatta", null, null, 1, SearchScope.EACH),
                new MachineFilter("Cybex", null, null, 1, SearchScope.EACH)),
            null);
        SearchDsl actual = new SearchDsl(
            new Location.Current(1.0),
            List.of(
                new MachineFilter("Matrix", null, null, 1, SearchScope.EACH),
                new MachineFilter("Cybex", null, null, 1, SearchScope.EACH)),
            null);

        SemanticMatcher.MatchResult result = SemanticMatcher.match(expected, actual);

        assertThat(result.matches()).isFalse();
        assertThat(result.mismatchField()).startsWith("machineFilters[");
    }

    @Test
    void filterFieldNullExpectedNonNullActualFails() {
        // expected: brand=Panatta, category=null. actual: brand=Panatta, category=Chest.
        // yaml is complete spec (Q9) → mismatch.
        SearchDsl expected = filterDsl(new MachineFilter("Panatta", null, null, 1, SearchScope.EACH));
        SearchDsl actual = filterDsl(new MachineFilter("Panatta", null, "Chest", 1, SearchScope.EACH));

        assertThat(SemanticMatcher.match(expected, actual).matches()).isFalse();
    }

    private static SearchDsl filterDsl(MachineFilter filter) {
        return new SearchDsl(new Location.Current(1.0), List.of(filter), null);
    }
}
