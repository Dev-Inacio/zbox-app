package com.zbox.backend.dto;

import com.zbox.backend.enums.ApprovalMethod;
import jakarta.validation.constraints.NotNull;

public class QuoteApproveRequest {

    @NotNull(message = "O método é obrigatório.")
    private ApprovalMethod method;

    public QuoteApproveRequest() {
    }

    public ApprovalMethod getMethod() {
        return method;
    }

    public void setMethod(ApprovalMethod method) {
        this.method = method;
    }
}
