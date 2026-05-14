package com.ironspot.search;

import com.ironspot.search.dsl.Coordinates;

public record ResolvedLocation(
    Coordinates coordinates,
    double radiusKm
) {}
