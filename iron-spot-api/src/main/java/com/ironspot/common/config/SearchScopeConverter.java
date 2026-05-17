package com.ironspot.common.config;

import com.ironspot.search.dsl.SearchScope;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * String → SearchScope converter for query-parameter binding.
 * <p>
 * Without this, Spring's default Enum converter calls {@code Enum.valueOf}
 * which requires an exact case match. Our public API serialises the enum as
 * lowercase via {@link SearchScope#toJson()} ({@code "each"} / {@code "combined"}),
 * so requests like {@code ?scope=each} would fail with 400 BAD_REQUEST.
 * <p>
 * This converter accepts any case (lowercase from the public API, uppercase
 * from internal callers) and rejects unknown values with the same
 * {@code IllegalArgumentException} as {@link SearchScope#fromJson}.
 * <p>
 * ADR 0022 / Task 45 Slice 45b.
 */
@Component
public class SearchScopeConverter implements Converter<String, SearchScope> {

    @Override
    public SearchScope convert(String source) {
        if (source == null || source.isBlank()) {
            return null;
        }
        return SearchScope.valueOf(source.toUpperCase(Locale.ROOT));
    }
}
