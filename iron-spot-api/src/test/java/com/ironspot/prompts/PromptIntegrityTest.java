package com.ironspot.prompts;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Security task #78: snapshot test that catches silent edits to LLM prompt
 * files that would relax security-critical rules. CODEOWNERS already
 * gates the PRs, but this test exists so a stray local commit (or a
 * future PR merged with a stale CODEOWNERS) is still flagged loudly at
 * CI time.
 *
 * <p>Each prompt file MUST carry these phrases verbatim. If a legitimate
 * rewording changes a phrase, update the assertion in the same PR — the
 * point is that the change is conscious + reviewed, not a regression.
 */
class PromptIntegrityTest {

    @Test
    void searchDslPromptCarriesRequiredGuards() throws IOException {
        String prompt = load("prompts/search-dsl.md");

        // Jailbreak meta-guard (task #63).
        assertThat(prompt).contains("untrusted data");
        assertThat(prompt).contains("ignore previous instructions");
        assertThat(prompt).contains("invalid input");

        // SQL keyword guard (rule 8).
        assertThat(prompt).contains("SQL keywords");
        assertThat(prompt).contains("DROP TABLE users");

        // gym-only domain guard.
        assertThat(prompt).contains("gym search only");

        // radius cap referenced in the prompt (mirrors Location.MAX_RADIUS_KM).
        assertThat(prompt).contains("20.0 km");
    }

    @Test
    void brandTransliteratePromptCarriesLockedReference() throws IOException {
        String prompt = load("prompts/brand-transliterate.md");

        // The 24-row launch catalog must still be referenced explicitly so
        // the LOCKED_EN_TO_KO map in AdminBrandTransliterateService stays
        // in sync with the prompt.
        assertThat(prompt).contains("Hammer Strength");
        assertThat(prompt).contains("해머 스트렝스");
        assertThat(prompt).contains("Cybex");
        assertThat(prompt).contains("사이벡스");
        assertThat(prompt).contains("뉴텍");

        // Output contract guards.
        assertThat(prompt).contains("Output ONLY the JSON object");
    }

    private static String load(String classpathResource) throws IOException {
        try (InputStream in = PromptIntegrityTest.class.getClassLoader()
                .getResourceAsStream(classpathResource)) {
            if (in == null) {
                throw new IllegalStateException("Missing classpath resource: " + classpathResource);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
