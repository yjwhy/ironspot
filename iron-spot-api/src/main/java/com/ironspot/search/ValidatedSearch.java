package com.ironspot.search;

import com.ironspot.search.dsl.Location;

import java.util.List;

public record ValidatedSearch(
    Location location,
    List<ResolvedFilter> filters
) {}
