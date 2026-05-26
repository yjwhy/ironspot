package com.ironspot.common.log;

import java.util.UUID;

/**
 * Security B3: PIPA treats account identifiers as personal data, so server
 * logs that may be shipped off-host (Render console, Loki, Sentry
 * breadcrumbs) must not carry the full user UUID. This helper prints only
 * the first 8 hex chars + ellipsis. Collisions are rare enough at our
 * single-region scale that the redacted form still pinpoints incidents
 * during postmortem, but cannot be joined back to a user without the
 * matching DB row.
 *
 * <p>Use everywhere we'd otherwise interpolate a UUID into a log message
 * (rate-limit warnings, quota trips, abuse alerts).
 */
public final class LogIds {

    private LogIds() {}

    /**
     * Returns the first 8 chars of the UUID's canonical form, followed by `…`.
     * Null → `null`.
     */
    public static String redact(UUID id) {
        return id == null ? "null" : redact(id.toString());
    }

    /**
     * String overload for the cases where the caller only has the userId as a
     * String (e.g. JWT subject claim, request header).
     */
    public static String redact(String idLike) {
        if (idLike == null) return "null";
        if (idLike.length() <= 8) return idLike;
        return idLike.substring(0, 8) + "…";
    }
}
