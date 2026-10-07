package com.zbox.backend.dto;

import com.zbox.backend.enums.ErrorCode;

import java.util.List;

public class ApiError {

    private String timestamp;
    private int status;
    private ErrorCode code;
    private String message;
    private String path;
    private List<FieldError> fieldErrors;

    public ApiError(String timestamp, int status, ErrorCode code, String message, String path, List<FieldError> fieldErrors) {
        this.timestamp = timestamp;
        this.status = status;
        this.code = code;
        this.message = message;
        this.path = path;
        this.fieldErrors = fieldErrors;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public ErrorCode getCode() {
        return code;
    }

    public void setCode(ErrorCode code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public List<FieldError> getFieldErrors() {
        return fieldErrors;
    }

    public void setFieldErrors(List<FieldError> fieldErrors) {
        this.fieldErrors = fieldErrors;
    }
}
