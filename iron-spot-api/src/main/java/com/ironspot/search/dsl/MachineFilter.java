package com.ironspot.search.dsl;

public record MachineFilter(
    String brand,
    String machineName,
    String category,
    int minCount,
    SearchScope scope
) {
    public MachineFilter {
        if (brand == null && machineName == null && category == null) {
            throw new IllegalArgumentException("at least one of brand/machineName/category must be set");
        }
        if (minCount < 1) {
            throw new IllegalArgumentException("minCount must be >= 1");
        }
        if (scope == null) {
            scope = SearchScope.EACH;
        }
    }
}
