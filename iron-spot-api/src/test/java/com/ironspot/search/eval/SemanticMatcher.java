package com.ironspot.search.eval;

import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;

import java.util.List;
import java.util.Locale;

/**
 * Compares an LLM-produced {@link SearchDsl} against a curated expected DSL with
 * per-field tolerance rules. Used by {@code EvalSuiteTest} to check NL Search
 * prompt regressions without requiring byte-exact LLM output.
 *
 * <p>Tolerance rules (decided in Phase 3 Task 39 grill):
 * <ul>
 *   <li>{@code location.radiusKm}: ±0.2 km</li>
 *   <li>{@code MachineFilter.brand}: case-insensitive equality</li>
 *   <li>{@code MachineFilter.machineName}: normalized equality (lowercase + whitespace stripped)</li>
 *   <li>{@code MachineFilter.category}: exact slug match</li>
 *   <li>{@code MachineFilter.minCount} / {@code scope}: exact</li>
 *   <li>{@code Location.NamedPlace.coordinates}: skipped (always null at LLM-parse stage,
 *     resolved later by {@code LocationResolver})</li>
 *   <li>{@code machineFilters}: size must match; elements compared order-agnostically</li>
 * </ul>
 *
 * <p>The expected DSL is treated as a complete spec: if {@code expected.brand == null}
 * and {@code actual.brand != null}, that is a mismatch. The yaml authors decide every
 * field deliberately.
 */
public final class SemanticMatcher {

    private static final double RADIUS_TOLERANCE_KM = 0.2;

    private SemanticMatcher() {}

    public record MatchResult(boolean matches, String mismatchField) {
        public static MatchResult ok() {
            return new MatchResult(true, null);
        }

        public static MatchResult fail(String field) {
            return new MatchResult(false, field);
        }
    }

    public static MatchResult match(SearchDsl expected, SearchDsl actual) {
        if (expected.error() != null || actual.error() != null) {
            if (!nullSafeEquals(expected.error(), actual.error())) {
                return MatchResult.fail("error");
            }
            return MatchResult.ok();
        }

        MatchResult locationResult = matchLocation(expected.location(), actual.location());
        if (!locationResult.matches()) return locationResult;

        return matchFilters(expected.machineFilters(), actual.machineFilters());
    }

    private static MatchResult matchLocation(Location expected, Location actual) {
        if (expected.getClass() != actual.getClass()) {
            return MatchResult.fail("location.type");
        }
        if (Math.abs(expected.radiusKm() - actual.radiusKm()) > RADIUS_TOLERANCE_KM) {
            return MatchResult.fail("location.radiusKm");
        }
        if (expected instanceof Location.NamedPlace e) {
            Location.NamedPlace a = (Location.NamedPlace) actual;
            if (!e.name().equals(a.name())) {
                return MatchResult.fail("location.name");
            }
        }
        return MatchResult.ok();
    }

    private static MatchResult matchFilters(List<MachineFilter> expected, List<MachineFilter> actual) {
        if (expected.size() != actual.size()) {
            return MatchResult.fail("machineFilters.size");
        }
        boolean[] used = new boolean[actual.size()];
        for (int i = 0; i < expected.size(); i++) {
            MachineFilter e = expected.get(i);
            int matchIdx = -1;
            for (int j = 0; j < actual.size(); j++) {
                if (used[j]) continue;
                if (filterMatches(e, actual.get(j))) {
                    matchIdx = j;
                    break;
                }
            }
            if (matchIdx < 0) {
                return MatchResult.fail("machineFilters[" + i + "]");
            }
            used[matchIdx] = true;
        }
        return MatchResult.ok();
    }

    private static boolean filterMatches(MachineFilter expected, MachineFilter actual) {
        return matchBrand(expected.brand(), actual.brand())
            && matchMachineName(expected.machineName(), actual.machineName())
            && matchCategory(expected.category(), actual.category())
            && expected.minCount() == actual.minCount()
            && expected.scope() == actual.scope();
    }

    private static boolean matchBrand(String expected, String actual) {
        if (expected == null) return actual == null;
        return actual != null
            && expected.toLowerCase(Locale.ROOT).equals(actual.toLowerCase(Locale.ROOT));
    }

    private static boolean matchMachineName(String expected, String actual) {
        if (expected == null) return actual == null;
        return actual != null && normalize(expected).equals(normalize(actual));
    }

    private static boolean matchCategory(String expected, String actual) {
        if (expected == null) return actual == null;
        return expected.equals(actual);
    }

    private static String normalize(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    private static boolean nullSafeEquals(Object a, Object b) {
        return a == null ? b == null : a.equals(b);
    }
}
