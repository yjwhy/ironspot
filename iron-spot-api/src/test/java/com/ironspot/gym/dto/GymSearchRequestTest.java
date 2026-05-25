package com.ironspot.gym.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bean validation on {@link GymSearchRequest}. Coordinate-level @DecimalMin /
 * @DecimalMax catches out-of-Earth values; @AssertTrue isBboxBounded catches
 * in-range but absurdly large boxes. Security task #21.
 */
class GymSearchRequestTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void smallBboxIsValid() {
        GymSearchRequest req = build(37.0, 37.5, 127.0, 127.5);

        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void boundaryBboxAt1DegreeIsAccepted() {
        GymSearchRequest req = build(37.0, 38.0, 127.0, 128.0);

        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void wholeGlobeBboxIsRejected() {
        GymSearchRequest req = build(-90.0, 90.0, -180.0, 180.0);

        Set<ConstraintViolation<GymSearchRequest>> violations = validator.validate(req);

        assertThat(violations)
            .extracting(ConstraintViolation::getMessage)
            .anyMatch(m -> m.contains("검색 영역"));
    }

    @Test
    void overLargeLatSpanIsRejected() {
        GymSearchRequest req = build(36.0, 38.5, 127.0, 127.5);

        Set<ConstraintViolation<GymSearchRequest>> violations = validator.validate(req);

        assertThat(violations).isNotEmpty();
    }

    @Test
    void overLargeLngSpanIsRejected() {
        GymSearchRequest req = build(37.0, 37.5, 126.0, 128.5);

        Set<ConstraintViolation<GymSearchRequest>> violations = validator.validate(req);

        assertThat(violations).isNotEmpty();
    }

    private static GymSearchRequest build(double minLat, double maxLat, double minLng, double maxLng) {
        GymSearchRequest req = new GymSearchRequest();
        req.setMinLat(minLat);
        req.setMaxLat(maxLat);
        req.setMinLng(minLng);
        req.setMaxLng(maxLng);
        return req;
    }
}
