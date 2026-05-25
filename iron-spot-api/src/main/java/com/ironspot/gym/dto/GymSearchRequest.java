package com.ironspot.gym.dto;

import com.ironspot.search.dsl.SearchScope;
import jakarta.validation.constraints.AssertTrue;
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

    /**
     * Hard cap on bbox edge length in degrees. Security task #21: prevents a
     * caller from passing {-90, 90, -180, 180} (whole globe) which would
     * sequential-scan the spatial index and dump the entire gym dataset. 1.0°
     * at the Seoul latitude is approximately 110km × 88km — well over the
     * largest reasonable map viewport on a mobile device (~5km × 5km zoom).
     */
    private static final double MAX_BBOX_DEGREES = 1.0;

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

    /**
     * Class-level cross-field check: each bbox edge must be {@link #MAX_BBOX_DEGREES}
     * or smaller. Coordinate-level @DecimalMin / @DecimalMax above guard against
     * out-of-Earth values; this guards against in-range but absurdly large boxes
     * (e.g. minLat=-90, maxLat=90).
     */
    @AssertTrue(message = "검색 영역이 너무 넓어요. 지도를 축소해 다시 시도해주세요.")
    public boolean isBboxBounded() {
        if (minLat == null || maxLat == null || minLng == null || maxLng == null) {
            return true; // @NotNull on each field catches this separately.
        }
        double latSpan = Math.abs(maxLat - minLat);
        double lngSpan = Math.abs(maxLng - minLng);
        return latSpan <= MAX_BBOX_DEGREES && lngSpan <= MAX_BBOX_DEGREES;
    }
}
