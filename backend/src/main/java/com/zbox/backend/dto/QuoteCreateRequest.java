package com.zbox.backend.dto;

import jakarta.validation.constraints.NotNull;

public class QuoteCreateRequest {

    @NotNull(message = "O cliente é obrigatório.")
    private Long customerId;

    public QuoteCreateRequest() {
    }

    public Long getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Long customerId) {
        this.customerId = customerId;
    }
}
