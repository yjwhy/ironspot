package com.ironspot.common.exception;

import com.ironspot.common.dto.ErrorResponse;
import io.sentry.Sentry;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private static final String INTERNAL_ERROR_MESSAGE = "서버 오류가 발생했습니다";

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
        // 5xx BusinessException is rare but possible (e.g. external service degraded → 503).
        // Surface those to Sentry; 4xx variants stay quiet (validation / auth domain errors).
        if (e.getStatus().is5xxServerError()) {
            Sentry.captureException(e);
        }
        return ResponseEntity.status(e.getStatus()).body(new ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleBind(BindException e) {
        // Security B2: avoid echoing DTO field names back to the client.
        // The detailed field info is still in the server log so debugging
        // is unchanged; the response keeps a generic Korean message that
        // doesn't help an API fuzzer enumerate request shape.
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("Bind validation failed: {}", detail);
        return new ErrorResponse("유효하지 않은 입력값입니다");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleConstraintViolation(ConstraintViolationException e) {
        // Security B2: same rationale as handleBind — generic client message,
        // detailed violation in the server log.
        String detail = e.getConstraintViolations().stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining(", "));
        log.warn("Constraint violation: {}", detail);
        return new ErrorResponse("유효하지 않은 입력값입니다");
    }

    // Without this handler Spring Boot 4's NoResourceFoundException bubbles up to handleUnexpected
    // and becomes a 500. Map it to a proper 404 so disabled conditional controllers (e.g. the
    // ironspot.slack.smoke.enabled=false gate on SlackSmokeController) behave as "not found"
    // rather than "server error".
    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(NoResourceFoundException e) {
        return new ErrorResponse("리소스를 찾을 수 없습니다");
    }

    // @PreAuthorize denials (Spring Security 6 method-level authorization) throw
    // AuthorizationDeniedException which extends AccessDeniedException. Without this handler
    // they bubble to handleUnexpected → 500 + Sentry noise.
    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ErrorResponse handleAccessDenied(AccessDeniedException e) {
        return new ErrorResponse("접근 권한이 없습니다");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleUnexpected(Exception e) {
        log.error("Unexpected error", e);
        // Any 5xx not already covered by the explicit handlers above (Bind/Constraint/NotFound
        // are 4xx; BusinessException 5xx captures inside its own handler). Sentry.captureException
        // no-ops when SentryConfig skipped init (empty DSN path).
        Sentry.captureException(e);
        return new ErrorResponse(INTERNAL_ERROR_MESSAGE);
    }
}
