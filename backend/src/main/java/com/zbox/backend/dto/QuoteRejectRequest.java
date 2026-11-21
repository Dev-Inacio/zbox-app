package com.zbox.backend.dto;

import com.zbox.backend.enums.RejectionReason;
import com.zbox.backend.util.TextUtils;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class QuoteRejectRequest {

    @NotNull(message = "O motivo da recusa é obrigatório.")
    private RejectionReason reason;

    @Size(max = 500, message = "A observação deve ter no máximo 500 caracteres.")
    private String note;

    public QuoteRejectRequest() {
    }

    public RejectionReason getReason() {
        return reason;
    }

    public void setReason(RejectionReason reason) {
        this.reason = reason;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = TextUtils.blankToNull(note);
    }
}
