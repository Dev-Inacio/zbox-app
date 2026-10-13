package com.zbox.backend.enums;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED),
    CUSTOMER_NOT_FOUND(HttpStatus.NOT_FOUND),
    CUSTOMER_ALREADY_INACTIVE(HttpStatus.CONFLICT),
    CUSTOMER_ALREADY_ACTIVE(HttpStatus.CONFLICT);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
