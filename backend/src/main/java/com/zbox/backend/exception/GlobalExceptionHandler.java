package com.zbox.backend.exception;

import com.zbox.backend.dto.ApiError;
import com.zbox.backend.dto.FieldError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;

import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(), 401, "INVALID_CREDENTIALS", "Usuário ou senha inválidos", request.getRequestURI(), List.of());

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(apiError);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidationErrors(MethodArgumentNotValidException exception, HttpServletRequest request) {

        List<FieldError> fieldErrorList = new ArrayList<>();

        for (org.springframework.validation.FieldError error : exception.getBindingResult().getFieldErrors()) {
            FieldError fieldError = new FieldError(error.getField(), "INVALID", error.getDefaultMessage());
            fieldErrorList.add(fieldError);
        }
        ApiError apiError = new ApiError(Instant.now().toString(), 400, "VALIDATION_ERROR", "Existem campos inválidos.", request.getRequestURI(), fieldErrorList);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(apiError);
    }
}
