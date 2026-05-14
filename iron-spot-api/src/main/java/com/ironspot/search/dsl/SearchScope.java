package com.ironspot.search.dsl;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum SearchScope {
    EACH,
    COMBINED;

    @JsonValue
    public String toJson() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static SearchScope fromJson(String value) {
        if (value == null) {
            throw new IllegalArgumentException("scope must not be null");
        }
        return SearchScope.valueOf(value.toUpperCase(Locale.ROOT));
    }
}
