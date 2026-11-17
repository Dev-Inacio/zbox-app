package com.zbox.backend.dto;

import com.zbox.backend.enums.ChargeType;
import com.zbox.backend.util.TextUtils;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public class QuoteItemRequest {

    @NotBlank(message = "A descrição é obrigatória.")
    @Size(min = 2, max = 200, message = "A descrição precisa ter entre 2 e 200 caracteres.")
    private String description;

    @NotNull(message = "O tipo de cobrança é obrigatório.")
    private ChargeType chargeType;

    @NotNull(message = "A quantidade é obrigatória.")
    @Min(value = 1, message = "A quantidade mínima é 1.")
    @Max(value = 9999, message = "A quantidade máxima é 9999.")
    private Integer quantity;

    @Size(max = 10, message = "A unidade pode ter no máximo 10 caracteres.")
    private String unit;

    @Min(value = 1, message = "A largura mínima é 1 cm.")
    @Max(value = 2000, message = "A largura máxima é 2000 cm.")
    private Integer widthCm;

    @Min(value = 1, message = "A altura mínima é 1 cm.")
    @Max(value = 2000, message = "A altura máxima é 2000 cm.")
    private Integer heightCm;

    @NotNull(message = "O preço unitário é obrigatório.")
    @Positive(message = "O preço unitário deve ser maior que zero.")
    private Long unitPriceCents;

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = TextUtils.blankToNull(description);
    }

    public ChargeType getChargeType() {
        return chargeType;
    }

    public void setChargeType(ChargeType chargeType) {
        this.chargeType = chargeType;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = TextUtils.blankToNull(unit);
    }

    public Integer getWidthCm() {
        return widthCm;
    }

    public void setWidthCm(Integer widthCm) {
        this.widthCm = widthCm;
    }

    public Integer getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(Integer heightCm) {
        this.heightCm = heightCm;
    }

    public Long getUnitPriceCents() {
        return unitPriceCents;
    }

    public void setUnitPriceCents(Long unitPriceCents) {
        this.unitPriceCents = unitPriceCents;
    }
}
