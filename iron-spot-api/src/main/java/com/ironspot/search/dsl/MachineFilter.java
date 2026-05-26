package com.ironspot.search.dsl;

public record MachineFilter(
    String brand,
    String machineName,
    String category,
    int minCount,
    SearchScope scope
) {
    /**
     * Security G1: cap free-text fields at 80 chars. The LLM is instructed
     * to keep them short but an adversarial prompt-injection completion
     * could otherwise return arbitrarily long strings that flow into log
     * lines, SQL bind params, and the analytics index untouched.
     */
    private static final int MAX_FIELD_LENGTH = 80;

    public MachineFilter {
        if (brand == null && machineName == null && category == null) {
            throw new IllegalArgumentException("at least one of brand/machineName/category must be set");
        }
        if (minCount < 1) {
            throw new IllegalArgumentException("minCount must be >= 1");
        }
        if (scope == null) {
            scope = SearchScope.EACH;
        }
        if (brand != null && brand.length() > MAX_FIELD_LENGTH) {
            throw new IllegalArgumentException("brand exceeds " + MAX_FIELD_LENGTH + " chars");
        }
        if (machineName != null && machineName.length() > MAX_FIELD_LENGTH) {
            throw new IllegalArgumentException("machineName exceeds " + MAX_FIELD_LENGTH + " chars");
        }
        if (category != null && category.length() > MAX_FIELD_LENGTH) {
            throw new IllegalArgumentException("category exceeds " + MAX_FIELD_LENGTH + " chars");
        }
    }
}
