package com.ironspot.gym.dto;

import com.ironspot.search.dsl.SearchScope;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class GymSearchRequest {

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    private Double minLat;

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    private Double maxLat;

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    private Double minLng;

    @NotNull
    @DecimalMax("180")
    @DecimalMin("-180")
    private Double maxLng;

    private List<String> brandIds;

    private List<String> categoryIds;

    /**
     * Machine template IDs. When empty/null: no template filter. When non-empty:
     * scope decides OR (any of these) vs AND (all of these).
     * ADR 0022 / Task 45.
     */
    private List<String> templateIds;

    /**
     * EACH = OR semantics (gym has at least one matching template).
     * COMBINED = AND semantics (gym has all of the requested templates).
     * Defaults to EACH when templateIds is non-empty and scope is null.
     */
    private SearchScope scope;
}
