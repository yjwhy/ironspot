package com.ironspot.search.llm;

/**
 * Security G6: shared sanitiser for LLM client responses. Previously
 * {@code GroqLlamaClient.stripCodeFence} and {@code GeminiFlashClient.
 * stripCodeFence} held two copies of the same logic, with the Gemini copy
 * trailing the Groq copy by one commit on average. A future safety fix
 * (e.g. nested-fence handling, BOM stripping, more languages) only needs
 * to land here once.
 *
 * <p>Conservative behaviour preserved from the originals:
 * <ul>
 *   <li>strip a single leading <code>```</code> and matching trailing
 *       <code>```</code>; nested fences fall through to the JSON parser
 *       unchanged.</li>
 *   <li>the language tag on the opening fence (e.g. <code>```json</code>)
 *       is consumed along with the rest of that line.</li>
 * </ul>
 */
public final class LlmResponseSanitiser {

    private LlmResponseSanitiser() {}

    /**
     * Tolerates {@code ```json ... ```} markdown code fences on an LLM
     * response so the downstream JSON parser sees raw JSON. No-op when the
     * input does not start with a triple backtick.
     */
    public static String stripCodeFence(String s) {
        String trimmed = s.trim();
        if (!trimmed.startsWith("```")) {
            return trimmed;
        }
        // Drop leading ``` (optionally followed by "json" or other language
        // tag) and the rest of that line.
        int newline = trimmed.indexOf('\n');
        trimmed = newline >= 0 ? trimmed.substring(newline + 1) : trimmed.substring(3);
        if (trimmed.endsWith("```")) {
            trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        return trimmed.trim();
    }
}
