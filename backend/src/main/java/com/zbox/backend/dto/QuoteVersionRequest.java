package com.zbox.backend.dto;

import com.zbox.backend.util.TextUtils;
import jakarta.validation.constraints.Size;

public class QuoteVersionRequest {

    @Size(max = 200, message = "O motivo deve ter no máximo 200 caracteres.")
    private String reason;

    public QuoteVersionRequest() {
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = TextUtils.blankToNull(reason);
    }
}
