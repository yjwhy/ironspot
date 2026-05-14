package com.ironspot.search;

import com.ironspot.search.dsl.SearchScope;

import java.util.List;
import java.util.UUID;

public record ResolvedFilter(
    UUID brandId,
    UUID categoryId,
    List<UUID> templateIds,
    int minCount,
    SearchScope scope
) {}
