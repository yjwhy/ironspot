package com.ironspot.owner;

import com.ironspot.owner.dto.BusinessRegistrationOcr;
import com.ironspot.owner.dto.VerificationResult;
import com.ironspot.photo.OcrService;
import com.ironspot.photo.SafeSearchVerdict;
import com.ironspot.photo.dto.VisionAnalysisResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BusinessRegistrationVerifierTest {

    @Mock OcrService ocrService;
    @Mock BusinessRegistryClient registryClient;

    // Security A5: HMAC-SHA256 needs a pepper; construct manually so the
    // ctor argument is satisfied with a deterministic IT fixture.
    private static final String TEST_PEPPER =
        "test-pepper-business-number-verifier-unit-test-32-plus-chars";

    private BusinessRegistrationVerifier verifier;

    @BeforeEach
    void newVerifier() {
        verifier = new BusinessRegistrationVerifier(ocrService, registryClient, TEST_PEPPER);
    }

    private static final byte[] DUMMY_IMAGE = "ignored-bytes".getBytes();

    private void mockOcr(String... texts) {
        when(ocrService.analyzeImage(any())).thenReturn(
            new VisionAnalysisResult(List.of(texts), SafeSearchVerdict.ALLOW, false));
    }

    @Test
    void verifyReturnsVerifiedOnAllMatch() {
        mockOcr(
            "사업자등록증",
            "사업자등록번호: 123-45-67890",
            "상호: 주식회사 분당짐",
            "대표자: 홍길동",
            "개업일: 2020-01-01");
        when(registryClient.validate(anyString(), anyString(), anyString(), anyString())).thenReturn(true);

        VerificationResult result = verifier.verify(DUMMY_IMAGE, "분당짐");

        assertThat(result).isInstanceOf(VerificationResult.Verified.class);
        VerificationResult.Verified v = (VerificationResult.Verified) result;
        assertThat(v.businessNumberHash()).hasSize(64);
        assertThat(v.ocr().businessNumber()).isEqualTo("1234567890");
        assertThat(v.ocr().businessName()).contains("분당짐");
        assertThat(v.ocr().representativeName()).isEqualTo("홍길동");
        assertThat(v.ocr().startDate()).isEqualTo("20200101");
    }

    @Test
    void verifyReturnsFailedWhenBusinessNumberNotExtracted() {
        mockOcr("사업자등록증", "(unreadable scan)");
        VerificationResult result = verifier.verify(DUMMY_IMAGE, "분당짐");
        assertThat(result).isInstanceOf(VerificationResult.Failed.class);
        assertThat(((VerificationResult.Failed) result).reason()).contains("사업자등록번호");
    }

    @Test
    void verifyReturnsFailedWhenRegistryInvalid() {
        mockOcr("사업자등록번호: 123-45-67890", "상호: 분당짐", "대표자: 홍길동", "개업일: 20200101");
        when(registryClient.validate(anyString(), anyString(), anyString(), anyString())).thenReturn(false);

        VerificationResult result = verifier.verify(DUMMY_IMAGE, "분당짐");
        assertThat(result).isInstanceOf(VerificationResult.Failed.class);
        assertThat(((VerificationResult.Failed) result).reason()).contains("국세청");
    }

    @Test
    void verifyReturnsDisputedWhenBusinessNameMismatchesGym() {
        mockOcr("사업자등록번호: 123-45-67890", "상호: 분당짐", "대표자: 홍길동", "개업일: 20200101");
        when(registryClient.validate(anyString(), anyString(), anyString(), anyString())).thenReturn(true);

        VerificationResult result = verifier.verify(DUMMY_IMAGE, "강남피트니스");

        assertThat(result).isInstanceOf(VerificationResult.Disputed.class);
        assertThat(((VerificationResult.Disputed) result).reason()).contains("상호");
    }

    @Test
    void verifyToleratesCorpFormPrefix() {
        mockOcr("사업자등록번호: 123-45-67890", "상호: 주식회사 분당짐", "대표자: 홍길동", "개업일: 20200101");
        when(registryClient.validate(anyString(), anyString(), anyString(), anyString())).thenReturn(true);

        // 사용자가 등록한 매장은 "분당짐" — 등록증의 "주식회사 분당짐" 와 corp-form normalization 후 매칭
        VerificationResult result = verifier.verify(DUMMY_IMAGE, "분당짐");
        assertThat(result).isInstanceOf(VerificationResult.Verified.class);
    }

    @Test
    void extractFieldsReturnsNullsOnPlainText() {
        mockOcr("그냥 영수증입니다");
        BusinessRegistrationOcr ocr = verifier.extractFields(DUMMY_IMAGE);
        assertThat(ocr.businessNumber()).isNull();
        assertThat(ocr.businessName()).isNull();
        assertThat(ocr.representativeName()).isNull();
        assertThat(ocr.startDate()).isNull();
    }

    @Test
    void extractFieldsHandlesHyphenlessBusinessNumber() {
        mockOcr("사업자등록번호 1234567890");
        BusinessRegistrationOcr ocr = verifier.extractFields(DUMMY_IMAGE);
        assertThat(ocr.businessNumber()).isEqualTo("1234567890");
    }

    @Test
    void extractFieldsParsesKoreanDateFormat() {
        mockOcr("개업일: 2020년 1월 5일", "사업자등록번호: 111-22-33333");
        BusinessRegistrationOcr ocr = verifier.extractFields(DUMMY_IMAGE);
        assertThat(ocr.startDate()).isEqualTo("20200105");
    }

    @Test
    void hashBusinessNumberIsDeterministicAndHex() {
        // Security A5: HMAC-SHA256 still produces 64 hex chars (matches
        // the C3 CHECK constraint) and is deterministic for the same
        // (pepper, input) pair, so re-claims by the same 사업자번호
        // still collapse to the same row.
        String h1 = verifier.hashBusinessNumber("1234567890");
        String h2 = verifier.hashBusinessNumber("1234567890");
        assertThat(h1).isEqualTo(h2).hasSize(64).matches("[0-9a-f]+");
        assertThat(verifier.hashBusinessNumber("9999999999")).isNotEqualTo(h1);
    }

    @Test
    void hashBusinessNumberDiffersAcrossPeppers() {
        // Security A5: changing the pepper changes every hash — that's
        // exactly the property that makes a DB dump useless without the
        // pepper. (Test both verifiers compute over the same input.)
        BusinessRegistrationVerifier other = new BusinessRegistrationVerifier(
            ocrService, registryClient,
            "alternate-test-pepper-business-number-verifier-32-plus-chars");
        assertThat(verifier.hashBusinessNumber("1234567890"))
            .isNotEqualTo(other.hashBusinessNumber("1234567890"));
    }

    @Test
    void constructorRejectsBlankPepper() {
        BusinessRegistrationVerifier blank =
            new BusinessRegistrationVerifier(ocrService, registryClient, "");
        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalStateException.class, blank::validatePepper);
    }

    @Test
    void constructorRejectsShortPepper() {
        BusinessRegistrationVerifier shortPepper =
            new BusinessRegistrationVerifier(ocrService, registryClient, "tooshort");
        org.junit.jupiter.api.Assertions.assertThrows(
            IllegalStateException.class, shortPepper::validatePepper);
    }

    @Test
    void matchesGymNameToleratesParenthesisedCorpForm() {
        assertThat(BusinessRegistrationVerifier.matchesGymName("(주)분당짐", "분당짐")).isTrue();
        assertThat(BusinessRegistrationVerifier.matchesGymName("㈜분당짐", "분당짐")).isTrue();
        assertThat(BusinessRegistrationVerifier.matchesGymName("분당짐", "강남짐")).isFalse();
    }
}
