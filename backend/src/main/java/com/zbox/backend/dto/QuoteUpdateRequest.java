package com.zbox.backend.dto;

import com.zbox.backend.enums.DiscountType;
import com.zbox.backend.util.TextUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class QuoteUpdateRequest {

    @NotNull(message = "A lista de itens é obrigatória.")
    @Size(max = 100, message = "O orçamento pode ter no máximo 100 itens.")
    @Valid
    private List<QuoteItemRequest> items;
    private DiscountType discountType;
    private Long discountValue;

    @Size(max = 200, message = "As condições de pagamento podem ter no máximo 200 caracteres.")
    private String paymentTerms;

    @Size(max = 1000, message = "As observações podem ter no máximo 1000 caracteres.")
    private String notes;

    public List<QuoteItemRequest> getItems() {
        return items;
    }

    public void setItems(List<QuoteItemRequest> items) {
        this.items = items;
    }

    public DiscountType getDiscountType() {
        return discountType;
    }

    public void setDiscountType(DiscountType discountType) {
        this.discountType = discountType;
    }

    public Long getDiscountValue() {
        return discountValue;
    }

    public void setDiscountValue(Long discountValue) {
        this.discountValue = discountValue;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public void setPaymentTerms(String paymentTerms) {
        this.paymentTerms = TextUtils.blankToNull(paymentTerms);
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = TextUtils.blankToNull(notes);
    }
}
