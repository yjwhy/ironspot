package com.ironspot.search.dsl;

import java.util.List;
import java.util.Set;

public record SearchDsl(
    Location location,
    List<MachineFilter> machineFilters,
    String error
) {
    /**
     * Security task #72: the LLM should only emit one of two error codes per the
     * search-dsl.md prompt contract. Whitespace-only differences (trailing space
     * etc.) used to fall through to {@code NlSearchService.translateDslError}'s
     * default branch and surface a generic "검색을 처리할 수 없어요" message; that
     * masks the real reason in the breadcrumb and gives an attacker an oracle
     * for "did my prompt injection produce a recognised vs unrecognised error
     * code". Normalise + strict-allowlist at the DSL boundary instead.
     */
    public static final Set<String> ALLOWED_ERRORS =
        Set.of("gym search only", "invalid input");

    /**
     * Security task #42: hard cap on the LLM-emitted filter array. The
     * gym search jOOQ builder creates one EXISTS subquery per filter and
     * resolves each through the brand / category catalogs (DslValidator);
     * an LLM that emits 100 filters under prompt injection would freeze
     * the Hikari pool. Five filters comfortably covers the longest real
     * search query ("파나타 하이로우 + 해머스트렝스 시티드로우 + ...").
     */
    public static final int MAX_MACHINE_FILTERS = 5;

    public SearchDsl {
        if (error != null) {
            // Trim is the only normalisation we apply — preserves the contract
            // text exactly while collapsing the trailing-whitespace oracle.
            error = error.trim();
            if (!ALLOWED_ERRORS.contains(error)) {
                throw new IllegalArgumentException(
                    "unknown error code (allowed: " + ALLOWED_ERRORS + ")");
            }
            if (location != null) {
                throw new IllegalArgumentException("error response must not carry a location");
            }
            machineFilters = List.of();
        } else {
            if (location == null) {
                throw new IllegalArgumentException("non-error response requires a location");
            }
            int count = machineFilters == null ? 0 : machineFilters.size();
            if (count > MAX_MACHINE_FILTERS) {
                throw new IllegalArgumentException(
                    "too many machineFilters (max " + MAX_MACHINE_FILTERS + ", got " + count + ")");
            }
            machineFilters = machineFilters == null ? List.of() : List.copyOf(machineFilters);
        }
    }
}
