package com.ironspot.search;

import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class InterpretationFormatter {

    public String format(SearchDsl dsl) {
        String location = formatLocation(dsl.location());
        if (dsl.machineFilters().isEmpty()) {
            return location + " 헬스장";
        }
        SearchScope scope = dsl.machineFilters().get(0).scope();
        String filters = scope == SearchScope.COMBINED
            ? formatCombined(dsl.machineFilters())
            : formatEach(dsl.machineFilters());
        // "{location}에 {filters} 보유한 헬스장" — the locative particle "에"
        // makes the whole string read as one natural sentence instead of a
        // bag of fragments.
        return location + "에 " + filters + " 보유한 헬스장";
    }

    private String formatLocation(Location location) {
        return switch (location) {
            case Location.Current c -> "내 위치 " + formatRadius(c.radiusKm()) + "km 이내";
            case Location.NamedPlace np -> np.name() + " " + formatRadius(np.radiusKm()) + "km 이내";
        };
    }

    // EACH scope: each filter is its own "must have ≥N" condition. SQL uses
    // SUM(quantity) >= minCount per filter, so the chip should say "최소 N개씩"
    // (at least N of each) — not "딱 3개".
    private String formatEach(List<MachineFilter> filters) {
        return filters.stream()
            .map(this::formatEachFilter)
            .collect(Collectors.joining(", "));
    }

    private String formatEachFilter(MachineFilter f) {
        StringBuilder sb = new StringBuilder();
        appendQualifiers(sb, f);
        sb.append("머신 최소 ").append(f.minCount()).append("개씩");
        return sb.toString();
    }

    // COMBINED scope: a single SUM(quantity) >= threshold across all filters
    // (DslValidator enforces same minCount across all). So we extract the
    // shared count once and join only the qualifiers with "또는":
    // "Panatta 또는 Technogym 머신 총 5개 이상" — reads naturally as a single
    // "total of N" claim against the union of brands/categories.
    private String formatCombined(List<MachineFilter> filters) {
        String qualifiers = filters.stream()
            .map(this::formatQualifiersOnly)
            .collect(Collectors.joining(" 또는 "));
        int count = filters.get(0).minCount();
        return qualifiers + " 머신 총 " + count + "개 이상";
    }

    private void appendQualifiers(StringBuilder sb, MachineFilter f) {
        if (f.brand() != null) sb.append(f.brand()).append(' ');
        if (f.category() != null) sb.append(f.category()).append(' ');
        if (f.machineName() != null) sb.append(f.machineName()).append(' ');
    }

    private String formatQualifiersOnly(MachineFilter f) {
        StringBuilder sb = new StringBuilder();
        if (f.brand() != null) sb.append(f.brand());
        if (f.category() != null) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(f.category());
        }
        if (f.machineName() != null) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(f.machineName());
        }
        return sb.toString();
    }

    private String formatRadius(double radiusKm) {
        if (radiusKm == Math.floor(radiusKm) && !Double.isInfinite(radiusKm)) {
            return Integer.toString((int) radiusKm);
        }
        return Double.toString(radiusKm);
    }
}
