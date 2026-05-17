package com.ironspot.owner.dto;

/**
 * Outcome of running 사업자등록증 OCR + 국세청 진위확인 against a target gym.
 *
 * Sealed type so OwnerService can exhaustively dispatch on the three outcomes
 * without a default branch.
 */
public sealed interface VerificationResult
    permits VerificationResult.Verified,
            VerificationResult.Disputed,
            VerificationResult.Failed {

    /**
     * OCR + 국세청 모두 통과, 상호 ≈ target gym name → 즉시 owner role grant.
     *
     * @param businessNumberHash SHA-256 hex of businessNumber, stored in gym_owners.business_number_hash.
     *                           Same hash on same gym = co-owner auto-allow; different hash = admin escalation.
     * @param ocr                Raw extracted fields (kept for audit_log metadata + Slack).
     */
    record Verified(String businessNumberHash, BusinessRegistrationOcr ocr) implements VerificationResult {}

    /**
     * 국세청 진위확인 통과했지만 상호가 target gym name 과 일치하지 않거나, OCR 상 일부 필드 missing.
     * Admin 큐로 escalation → admin 이 수동 확인 후 grant 또는 reject.
     *
     * @param reason 사용자 표시용 메시지 (예: "상호가 매장 이름과 다릅니다. admin 검토 중...").
     * @param ocr    추출된 필드 (admin 큐 카드에 표시).
     */
    record Disputed(String reason, BusinessRegistrationOcr ocr) implements VerificationResult {}

    /**
     * OCR 자체 실패 (사업자번호 추출 불가) 또는 국세청 진위확인 invalid → 즉시 reject.
     * 사용자는 재촬영 안내.
     *
     * @param reason 사용자 표시용 메시지 (예: "사업자등록번호를 인식할 수 없어요. 다시 찍어주세요").
     */
    record Failed(String reason) implements VerificationResult {}
}
