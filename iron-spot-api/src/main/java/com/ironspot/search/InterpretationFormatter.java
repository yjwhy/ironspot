package com.ironspot.search;

import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class InterpretationFormatter {

    public String format(SearchDsl dsl) {
        String location = formatLocation(dsl.location());
        if (dsl.machineFilters().isEmpty()) {
            return location;
        }
        String separator = dsl.machineFilters().get(0).scope() == SearchScope.COMBINED
            ? " 또는 "
            : " + ";
        String filters = dsl.machineFilters().stream()
            .map(this::formatFilter)
            .collect(Collectors.joining(separator));
        return location + " / " + filters;
    }

    private String formatLocation(Location location) {
        return switch (location) {
            case Location.Current c -> "내 위치 " + formatRadius(c.radiusKm()) + "km 이내";
            case Location.NamedPlace np -> np.name() + " " + formatRadius(np.radiusKm()) + "km 이내";
        };
    }

    private String formatFilter(MachineFilter f) {
        StringBuilder sb = new StringBuilder();
        if (f.brand() != null) sb.append(f.brand()).append(' ');
        if (f.category() != null) sb.append(f.category()).append(' ');
        if (f.machineName() != null) sb.append(f.machineName()).append(' ');
        sb.append(f.minCount()).append('개');
        sb.append(f.scope() == SearchScope.COMBINED ? " 합쳐서" : " each");
        return sb.toString().trim();
    }

    private String formatRadius(double radiusKm) {
        if (radiusKm == Math.floor(radiusKm) && !Double.isInfinite(radiusKm)) {
            return Integer.toString((int) radiusKm);
        }
        return Double.toString(radiusKm);
    }
}
