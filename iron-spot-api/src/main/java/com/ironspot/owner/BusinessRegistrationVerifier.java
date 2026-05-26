package com.ironspot.owner;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.owner.dto.BusinessRegistrationOcr;
import com.ironspot.owner.dto.VerificationResult;
import com.ironspot.photo.OcrService;
import com.ironspot.photo.dto.VisionAnalysisResult;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Orchestrates 사업자등록증 OCR (Vision) + 국세청 진위확인 (BusinessRegistryClient) +
 * gym-name matching for owner claim verification (Task 47 / ADR 0023 Q1 U).
 *
 * <p>Flow:
 * <ol>
 *   <li>Vision API OCR via OcrService — extract raw text array</li>
 *   <li>Regex extraction of 사업자등록번호 + 상호 + 대표자 + 개업일</li>
 *   <li>국세청 4-tuple validation via BusinessRegistryClient</li>
 *   <li>Tolerant string match between extracted 상호 and target gym name</li>
 *   <li>SHA-256 hash of 사업자등록번호 → {@link VerificationResult.Verified}</li>
 * </ol>
 *
 * <p>Failure modes:
 * <ul>
 *   <li>사업자번호 not parseable → {@link VerificationResult.Failed} (retake photo)</li>
 *   <li>국세청 invalid → {@link VerificationResult.Failed} (4-tuple mismatch)</li>
 *   <li>국세청 valid but 상호 mismatch → {@link VerificationResult.Disputed} (admin manual)</li>
 *   <li>국세청 API key missing → all paths fall to Disputed (admin manual)</li>
 * </ul>
 *
 * <p>The image bytes never touch disk. Vision API is called in-memory; extracted
 * fields stay in JVM heap; on return only the SHA-256 hash + structured
 * BusinessRegistrationOcr (audit metadata) are kept by the caller for the
 * gym_owners insert + moderation_audit_log row. Original photo bytes go out of
 * scope and are GC-collected.
 */
@Slf4j
@Service
public class BusinessRegistrationVerifier {

    private final OcrService ocrService;
    private final BusinessRegistryClient registryClient;

    /**
     * Security A5: server-side pepper for HMAC-SHA256 over the
     * 사업자등록번호. Required at runtime — the {@code @PostConstruct}
     * validator below fails the application boot if it is missing or
     * obviously too short to provide useful entropy. The pepper lives
     * in Render env / Supabase secrets only — it must not appear in
     * the database, the codebase, or Sentry breadcrumbs.
     */
    private final String hashPepper;

    public BusinessRegistrationVerifier(
        OcrService ocrService,
        BusinessRegistryClient registryClient,
        @Value("${ironspot.business-number.hash-pepper:}") String hashPepper
    ) {
        this.ocrService = ocrService;
        this.registryClient = registryClient;
        this.hashPepper = hashPepper;
    }

    @PostConstruct
    void validatePepper() {
        if (hashPepper == null || hashPepper.isBlank()) {
            throw new IllegalStateException(
                "IRONSPOT_BUSINESS_HASH_PEPPER is not configured. "
                    + "Required to hash 사업자번호; otherwise a DB dump would "
                    + "expose every owner's 사업자번호 to a ~640GB rainbow "
                    + "table attack against the raw SHA-256.");
        }
        if (hashPepper.length() < 32) {
            // 256 bits of entropy = 32 bytes; require at least that many
            // characters (base64-encoded random data is the recommended
            // format → 32 chars covers 192 bits which is the practical
            // floor for HMAC keys).
            throw new IllegalStateException(
                "IRONSPOT_BUSINESS_HASH_PEPPER must be at least 32 characters "
                    + "(got " + hashPepper.length() + "). Generate via "
                    + "`openssl rand -base64 48`.");
        }
    }

    /**
     * 10-digit 사업자번호. Accepts hyphenated form (xxx-xx-xxxxx) or plain (xxxxxxxxxx).
     * Extracts to plain digits-only form.
     */
    private static final Pattern BUSINESS_NUMBER_PATTERN =
        Pattern.compile("(\\d{3})-?(\\d{2})-?(\\d{5})");

    /**
     * YYYY-MM-DD / YYYY.MM.DD / YYYY년 M월 D일 / YYYYMMDD → extracts to YYYYMMDD.
     * Separators are optional ({@code *}) so compact form parses with the same pattern.
     */
    private static final Pattern START_DATE_PATTERN =
        Pattern.compile("(\\d{4})[-.년\\s]*(\\d{1,2})[-.월\\s]*(\\d{1,2})");

    /** Label-prefixed field extraction. Korean business reg layouts vary. */
    private static final Pattern BUSINESS_NAME_PATTERN =
        Pattern.compile("(?:상\\s*호|법인명)[\\s:：]*([^\\n]+)");

    /**
     * Capture class is intentionally Hangul + Latin + space-only (NOT {@code \s}) — \s
     * includes \n, which would let the capture group span past the representative line
     * into the next field. Multi-word Korean names use a regular space between syllables.
     */
    private static final Pattern REPRESENTATIVE_PATTERN =
        Pattern.compile("(?:대\\s*표\\s*자|성\\s*명)[\\s:：]*([\\p{IsHangul}A-Za-z][\\p{IsHangul}A-Za-z ]{0,30})");

    /** Boilerplate corporation-form prefixes/suffixes stripped before matching. */
    private static final List<String> CORP_FORMS =
        List.of("주식회사", "유한회사", "합자회사", "합명회사", "(주)", "(유)", "㈜");

    public VerificationResult verify(byte[] imageBytes, String targetGymName) {
        BusinessRegistrationOcr ocr = extractFields(imageBytes);
        if (ocr.businessNumber() == null) {
            return new VerificationResult.Failed(
                "사업자등록번호를 인식할 수 없어요. 등록증이 잘 보이도록 다시 촬영해 주세요.");
        }

        boolean validInRegistry = registryClient.validate(
            ocr.businessNumber(),
            ocr.startDate(),
            ocr.representativeName(),
            ocr.businessName());
        if (!validInRegistry) {
            return new VerificationResult.Failed(
                "국세청에서 사업자등록 정보를 확인할 수 없어요. 등록증 정보가 정확한지 확인 후 다시 시도해 주세요.");
        }

        if (!matchesGymName(ocr.businessName(), targetGymName)) {
            return new VerificationResult.Disputed(
                "등록증의 상호와 매장 이름이 달라요. admin 이 검토 중이에요 (보통 24시간 이내).",
                ocr);
        }

        String hash = hashBusinessNumber(ocr.businessNumber());
        return new VerificationResult.Verified(hash, ocr);
    }

    BusinessRegistrationOcr extractFields(byte[] imageBytes) {
        VisionAnalysisResult vision = ocrService.analyzeImage(imageBytes);
        String fullText = String.join("\n", vision.texts());

        String businessNumber = matchFirst(BUSINESS_NUMBER_PATTERN, fullText, m -> m.group(1) + m.group(2) + m.group(3));
        String startDate = matchFirst(START_DATE_PATTERN, fullText, m ->
            m.group(1)
                + pad2(m.group(2))
                + pad2(m.group(3)));
        String businessName = matchFirst(BUSINESS_NAME_PATTERN, fullText, m -> m.group(1).trim());
        String representative = matchFirst(REPRESENTATIVE_PATTERN, fullText, m -> m.group(1).trim());

        return new BusinessRegistrationOcr(businessNumber, businessName, representative, startDate);
    }

    static boolean matchesGymName(String extracted, String target) {
        if (extracted == null || target == null) return false;
        String a = normalizeName(extracted);
        String b = normalizeName(target);
        if (a.isEmpty() || b.isEmpty()) return false;
        return a.contains(b) || b.contains(a);
    }

    private static String normalizeName(String s) {
        String t = s;
        for (String prefix : CORP_FORMS) {
            t = t.replace(prefix, "");
        }
        return t.replaceAll("\\s+", "").trim();
    }

    private static String pad2(String digits) {
        return digits.length() == 1 ? "0" + digits : digits;
    }

    private static String matchFirst(Pattern p, String text, java.util.function.Function<Matcher, String> extractor) {
        Matcher m = p.matcher(text);
        return m.find() ? extractor.apply(m) : null;
    }

    /**
     * Security A5: HMAC-SHA256 over (pepper, 사업자번호).
     *
     * <p>Why HMAC rather than plain SHA-256(pepper || input):
     * <ul>
     *   <li>HMAC is the standard construction for keyed hashes; it resists
     *       the length-extension attack that plain {@code SHA-256(k || m)}
     *       is theoretically vulnerable to.</li>
     *   <li>The output is the same 32 bytes / 64 hex chars as the previous
     *       raw SHA-256, so the {@code C3} CHECK constraint
     *       {@code business_number_hash ~ '^[0-9a-f]{64}$'} keeps holding
     *       without a schema change.</li>
     * </ul>
     *
     * <p>If the pepper ever needs to rotate, that becomes a forced
     * re-verification of all active owners (each row's hash needs
     * recomputing with the new pepper, which requires the original
     * 사업자번호 — that data is gone). For now the policy is "don't
     * rotate", documented in the audit doc.
     */
    public String hashBusinessNumber(String businessNumber) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hashPepper.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(businessNumber.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            // HmacSHA256 is required by every JVM since Java 1.4.2; the
            // pepper is non-empty by @PostConstruct invariant. Never
            // thrown in practice.
            throw new BusinessException(
                "서버 설정 오류로 owner 인증을 진행할 수 없어요",
                HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
