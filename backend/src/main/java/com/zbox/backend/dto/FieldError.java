package com.zbox.backend.dto;

import com.zbox.backend.enums.FieldErrorCode;

public class FieldError {

    private String field;
    private FieldErrorCode code;
    private String message;

    public FieldError(String field, FieldErrorCode code, String message) {
        this.field = field;
        this.code = code;
        this.message = message;
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public FieldErrorCode getCode() {
        return code;
    }

    public void setCode(FieldErrorCode code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
