package com.ironspot.search.dsl;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = Location.Current.class, name = "current"),
    @JsonSubTypes.Type(value = Location.NamedPlace.class, name = "named_place")
})
public sealed interface Location permits Location.Current, Location.NamedPlace {

    /**
     * Hard bounds for any user-controllable / LLM-emitted radius.
     * Security tasks #21 + #63: a 20km cap keeps ST_DWithin from spilling onto
     * sequential scans across the entire spatial index even under prompt
     * injection like "radiusKm: 99999". MIN > 0 guards against NaN / negative /
     * zero values that produce degenerate PostGIS results.
     *
     * The 60-char name cap on NamedPlace blocks an LLM from forwarding a giant
     * payload to Naver Geocode (rate-limited external API, see task #76).
     */
    double MIN_RADIUS_KM = 0.1;
    double MAX_RADIUS_KM = 20.0;
    int MAX_NAME_LENGTH = 60;

    double radiusKm();

    record Current(double radiusKm) implements Location {
        public Current {
            validateRadius(radiusKm);
        }
    }

    /**
     * Named place such as a station, neighborhood, or landmark.
     * {@code coordinates} is null at LLM-parse time; the server resolves it
     * via Naver geocoder before SQL build (Task 36).
     */
    record NamedPlace(String name, Coordinates coordinates, double radiusKm) implements Location {
        public NamedPlace {
            if (name == null || name.isBlank()) {
                throw new IllegalArgumentException("name must not be blank");
            }
            if (name.length() > MAX_NAME_LENGTH) {
                throw new IllegalArgumentException(
                    "name length must be <= " + MAX_NAME_LENGTH + ", got: " + name.length());
            }
            validateRadius(radiusKm);
        }
    }

    private static void validateRadius(double radiusKm) {
        if (Double.isNaN(radiusKm) || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
            throw new IllegalArgumentException(
                "radiusKm must be in [" + MIN_RADIUS_KM + ", " + MAX_RADIUS_KM
                    + "], got: " + radiusKm);
        }
    }
}
