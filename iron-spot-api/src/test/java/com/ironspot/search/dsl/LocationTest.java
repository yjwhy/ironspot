package com.ironspot.search.dsl;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Compact-constructor invariants on {@link Location}. These guard against
 * LLM-emitted out-of-range / malformed values reaching the SQL layer.
 * Security tasks #21 + #63.
 */
class LocationTest {

    @Test
    void currentAcceptsRadiusInsideBounds() {
        assertThat(new Location.Current(1.0).radiusKm()).isEqualTo(1.0);
        assertThat(new Location.Current(Location.MIN_RADIUS_KM).radiusKm())
            .isEqualTo(Location.MIN_RADIUS_KM);
        assertThat(new Location.Current(Location.MAX_RADIUS_KM).radiusKm())
            .isEqualTo(Location.MAX_RADIUS_KM);
    }

    @Test
    void currentRejectsRadiusAboveMax() {
        assertThatThrownBy(() -> new Location.Current(Location.MAX_RADIUS_KM + 0.01))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("radiusKm");
    }

    @Test
    void currentRejectsRadiusBelowMin() {
        assertThatThrownBy(() -> new Location.Current(Location.MIN_RADIUS_KM - 0.01))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("radiusKm");
    }

    @Test
    void currentRejectsZeroAndNegative() {
        assertThatThrownBy(() -> new Location.Current(0.0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Location.Current(-1.0))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void currentRejectsNaN() {
        assertThatThrownBy(() -> new Location.Current(Double.NaN))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void currentRejectsHugeValue() {
        assertThatThrownBy(() -> new Location.Current(99999.0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Location.Current(Double.MAX_VALUE))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void namedPlaceAcceptsNormalInput() {
        Location.NamedPlace place = new Location.NamedPlace("강남역", null, 1.0);
        assertThat(place.name()).isEqualTo("강남역");
        assertThat(place.radiusKm()).isEqualTo(1.0);
    }

    @Test
    void namedPlaceRejectsBlankName() {
        assertThatThrownBy(() -> new Location.NamedPlace("", null, 1.0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("name");
        assertThatThrownBy(() -> new Location.NamedPlace("   ", null, 1.0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Location.NamedPlace(null, null, 1.0))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void namedPlaceRejectsOverLongName() {
        String tooLong = "a".repeat(Location.MAX_NAME_LENGTH + 1);
        assertThatThrownBy(() -> new Location.NamedPlace(tooLong, null, 1.0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("name length");
    }

    @Test
    void namedPlaceAcceptsExactlyMaxLength() {
        String exact = "a".repeat(Location.MAX_NAME_LENGTH);
        Location.NamedPlace place = new Location.NamedPlace(exact, null, 1.0);
        assertThat(place.name()).hasSize(Location.MAX_NAME_LENGTH);
    }

    @Test
    void namedPlaceRejectsOutOfRangeRadius() {
        assertThatThrownBy(() -> new Location.NamedPlace("강남역", null, 99999.0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Location.NamedPlace("강남역", null, 0.0))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
