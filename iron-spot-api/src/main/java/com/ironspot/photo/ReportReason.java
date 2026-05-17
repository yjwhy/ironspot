package com.ironspot.photo;

/**
 * Report reasons. Two surfaces share this enum:
 * <ul>
 *   <li>{@code target_type = 'photo'} (Task 33): INAPPROPRIATE, WRONG_MACHINE, DUPLICATE, OTHER, LEGAL_PERSONAL</li>
 *   <li>{@code target_type = 'gym_machine'} (Task 46): WRONG_TEMPLATE, NOT_PRESENT, OTHER</li>
 * </ul>
 * Per-surface subsets enforced in the frontend's {@code reportReasons.ts}.
 * Backend trusts the (target_type, reason) pair the controller hands it — admin
 * disposition cascades branch on both.
 */
public enum ReportReason {
    // Photo-specific
    INAPPROPRIATE,
    WRONG_MACHINE,
    DUPLICATE,
    LEGAL_PERSONAL,

    // gym_machine-specific (Task 46)
    WRONG_TEMPLATE,
    NOT_PRESENT,

    // Cross-cutting
    OTHER;

    public boolean isUrgent() {
        return this == LEGAL_PERSONAL;
    }
}
