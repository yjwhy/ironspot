package com.ironspot.owner.dto;

/**
 * Fields extracted from a 사업자등록증 photo via Vision API OCR.
 *
 * All fields except businessNumber are best-effort: regex-based extraction from
 * the OCR text can miss fields on poor-quality scans. Verifier falls back to
 * "Failed" verification when businessNumber is missing, "Disputed" when other
 * fields are missing (admin manual review).
 *
 * @param businessNumber 10-digit 사업자등록번호 ("xxx-xx-xxxxx" → "xxxxxxxxxx"). Required.
 * @param businessName   상호 (e.g., "주식회사 분당짐"). May be null on poor OCR.
 * @param representativeName 대표자명. May be null.
 * @param startDate      개업일 YYYYMMDD. May be null.
 */
public record BusinessRegistrationOcr(
    String businessNumber,
    String businessName,
    String representativeName,
    String startDate
) {}
