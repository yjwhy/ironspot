package com.ironspot.search.dsl;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = Location.Current.class, name = "current"),
    @JsonSubTypes.Type(value = Location.NamedPlace.class, name = "named_place")
})
public sealed interface Location permits Location.Current, Location.NamedPlace {

    double radiusKm();

    record Current(double radiusKm) implements Location {}

    /**
     * Named place such as a station, neighborhood, or landmark.
     * {@code coordinates} is null at LLM-parse time; the server resolves it
     * via Naver geocoder before SQL build (Task 36).
     */
    record NamedPlace(String name, Coordinates coordinates, double radiusKm) implements Location {}
}
