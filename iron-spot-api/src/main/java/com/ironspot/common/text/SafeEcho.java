package com.ironspot.common.text;

/**
 * Shared helpers for echoing user-supplied strings into error messages, log
 * lines, and Sentry breadcrumbs without amplifying a prompt-injection or
 * reflected-DoS payload. Security tasks #44, #45.
 *
 * <p>Every code path that surfaces user input back to the user (or to a
 * third-party observability sink) MUST go through this util.
 */
public final class SafeEcho {

    private SafeEcho() {}

    /** Default cap for echo / breadcrumb fields. */
    public static final int DEFAULT_MAX = 30;

    /**
     * Truncate without sanitisation. Use only for fields that flow into a
     * log line (operator-facing) — never into a response body or Sentry
     * payload visible to a third party.
     */
    public static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }

    /**
     * Truncate + strip control / HTML / quote characters. Use for fields that
     * appear in BusinessException messages (echoed to the API consumer) and
     * Sentry breadcrumbs (echoed to operators in the third-party SaaS UI).
     * Pattern matches the OWASP cheat-sheet "log-and-display" recommendation.
     */
    public static String sanitise(String s, int max) {
        if (s == null) return "";
        String trimmed = truncate(s, max);
        // \p{C} covers Cc (control), Cf (format — RTL override U+202E,
        // zero-width joiner U+200D, BOM U+FEFF, ...), Cs (surrogate),
        // Co (private use), Cn (unassigned). Plus HTML / quote scaffolding.
        // Korean / Latin letters are L* so they are unaffected.
        return trimmed.replaceAll("[<>\"'&\\p{C}]", "");
    }

    /** Convenience: sanitise with the default max. */
    public static String sanitise(String s) {
        return sanitise(s, DEFAULT_MAX);
    }
}
