package com.ironspot.search.dsl;

import java.util.List;

public record SearchDsl(
    Location location,
    List<MachineFilter> machineFilters,
    String error
) {
    public SearchDsl {
        if (error != null) {
            if (location != null) {
                throw new IllegalArgumentException("error response must not carry a location");
            }
            machineFilters = List.of();
        } else {
            if (location == null) {
                throw new IllegalArgumentException("non-error response requires a location");
            }
            machineFilters = machineFilters == null ? List.of() : List.copyOf(machineFilters);
        }
    }
}
