package com.zbox.backend.exception;

import com.zbox.backend.dto.ApiError;
import com.zbox.backend.dto.FieldError;
import com.zbox.backend.enums.ErrorCode;
import com.zbox.backend.enums.FieldErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.INVALID_CREDENTIALS.getStatus().value(),
                ErrorCode.INVALID_CREDENTIALS,
                "Usuário ou senha inválidos",
                request.getRequestURI(), List.of());

        return ResponseEntity.status(ErrorCode.INVALID_CREDENTIALS.getStatus()).body(apiError);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidationErrors(MethodArgumentNotValidException exception, HttpServletRequest request) {

        List<FieldError> fieldErrorList = new ArrayList<>();

        for (org.springframework.validation.FieldError error : exception.getBindingResult().getFieldErrors()) {
            FieldError fieldError = new FieldError(error.getField(), FieldErrorCode.INVALID, error.getDefaultMessage());
            fieldErrorList.add(fieldError);
        }
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.VALIDATION_ERROR.getStatus().value(),
                ErrorCode.VALIDATION_ERROR,
                "Existem campos inválidos.",
                request.getRequestURI(), fieldErrorList);

        return ResponseEntity.status(ErrorCode.VALIDATION_ERROR.getStatus()).body(apiError);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiError> handleBusinessException(BusinessException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                exception.getErrorCode().getStatus().value(),
                exception.getErrorCode(),
                exception.getMessage(),
                request.getRequestURI(),
                List.of());

        return ResponseEntity.status(exception.getErrorCode().getStatus()).body(apiError);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleMalformedRequest(HttpMessageNotReadableException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.MALFORMED_REQUEST.getStatus().value(),
                ErrorCode.MALFORMED_REQUEST,
                "Corpo da requisição inválido ou malformado.",
                request.getRequestURI(),
                List.of());

        return ResponseEntity.status(ErrorCode.MALFORMED_REQUEST.getStatus()).body(apiError);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpectedException(Exception exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.INTERNAL_ERROR.getStatus().value(),
                ErrorCode.INTERNAL_ERROR,
                "Erro interno. Tente novamente mais tarde.",
                request.getRequestURI(),
                List.of());

        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.getStatus()).body(apiError);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.FORBIDDEN.getStatus().value(),
                ErrorCode.FORBIDDEN,
                "Você não tem permissão para realizar esta ação.",
                request.getRequestURI(),
                List.of());

        return ResponseEntity.status(ErrorCode.FORBIDDEN.getStatus()).body(apiError);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NoResourceFoundException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.NOT_FOUND.getStatus().value(),
                ErrorCode.NOT_FOUND,
                "Recurso não encontrado.",
                request.getRequestURI(),
                List.of());

        return ResponseEntity.status(ErrorCode.NOT_FOUND.getStatus()).body(apiError);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotAllowed(HttpRequestMethodNotSupportedException exception, HttpServletRequest request) {
        ApiError apiError = new ApiError(Instant.now().toString(),
                ErrorCode.METHOD_NOT_ALLOWED.getStatus().value(),
                ErrorCode.METHOD_NOT_ALLOWED,
                "Método HTTP não permitido para esta rota.",
                request.getRequestURI(),
                List.of());

        return ResponseEntity.status(ErrorCode.METHOD_NOT_ALLOWED.getStatus()).body(apiError);
    }
}
