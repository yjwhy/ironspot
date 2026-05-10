package com.ironspot.photo;

public enum ReportReason {
    INAPPROPRIATE,
    WRONG_MACHINE,
    DUPLICATE,
    OTHER,
    LEGAL_PERSONAL;

    public boolean isUrgent() {
        return this == LEGAL_PERSONAL;
    }
}
