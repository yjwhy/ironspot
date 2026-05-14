package com.ironspot.search.llm;

import com.ironspot.common.exception.BusinessException;
import org.springframework.http.HttpStatus;

public class LlmException extends BusinessException {

    public enum Kind {
        RATE_LIMIT,
        TIMEOUT,
        INVALID_RESPONSE,
        TRANSPORT
    }

    private final Kind kind;

    public LlmException(Kind kind, String message) {
        super(message, toStatus(kind));
        this.kind = kind;
    }

    public LlmException(Kind kind, String message, Throwable cause) {
        super(message, toStatus(kind));
        initCause(cause);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }

    private static HttpStatus toStatus(Kind kind) {
        return switch (kind) {
            case RATE_LIMIT -> HttpStatus.SERVICE_UNAVAILABLE;
            case TIMEOUT -> HttpStatus.GATEWAY_TIMEOUT;
            case TRANSPORT, INVALID_RESPONSE -> HttpStatus.BAD_GATEWAY;
        };
    }
}
