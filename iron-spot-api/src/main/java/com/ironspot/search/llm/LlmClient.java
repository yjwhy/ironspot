package com.ironspot.search.llm;

import com.ironspot.search.dsl.SearchDsl;

public interface LlmClient {
    SearchDsl parse(String userQuery);
}
