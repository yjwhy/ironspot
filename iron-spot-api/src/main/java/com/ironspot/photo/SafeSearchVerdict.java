package com.ironspot.photo;

import java.util.Map;

public enum SafeSearchVerdict {
    ALLOW,
    QUEUE_FOR_ADMIN,
    REJECT;

    private static final String VERY_LIKELY = "VERY_LIKELY";
    private static final String LIKELY = "LIKELY";

    /**
     * Conservative thresholds tuned for IronSpot's gym domain:
     * `racy`/`medical` are ignored because athletic content (shirtless lifters,
     * muscle close-ups) produces a high false-positive rate on those signals.
     */
    public static SafeSearchVerdict from(Map<?, ?> annotation) {
        if (annotation == null) return ALLOW;
        Object adult = annotation.get("adult");
        Object violence = annotation.get("violence");
        if (VERY_LIKELY.equals(adult) || VERY_LIKELY.equals(violence)) return REJECT;
        if (LIKELY.equals(adult) || LIKELY.equals(violence)) return QUEUE_FOR_ADMIN;
        return ALLOW;
    }
}
