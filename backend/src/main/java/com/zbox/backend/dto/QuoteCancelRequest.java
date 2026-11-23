package com.zbox.backend.dto;

import com.zbox.backend.util.TextUtils;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class QuoteCancelRequest {

    @NotBlank(message = "O motivo é obrigatório.")
    @Size(min = 3, max = 500, message = "O motivo deve ter entre 3 e 500 caracteres.")
    private String reason;

    public QuoteCancelRequest() {
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = TextUtils.blankToNull(reason);
    }
}