package com.zbox.backend.dto;

import com.zbox.backend.enums.ChargeType;

public class QuoteItemResponse {
    private final Long id;
    private final String description;
    private final ChargeType chargeType;
    private final int quantity;
    private final String unit;
    private final Integer widthCm;
    private final Integer heightCm;
    private final long unitPriceCents;
    private final Long areaPerPieceCm2;
    private final long subtotalCents;

    public QuoteItemResponse(Long id, String description, ChargeType chargeType, int quantity, String unit, Integer widthCm, Integer heightCm, long unitPriceCents, Long areaPerPieceCm2, long subtotalCents) {
        this.id = id;
        this.description = description;
        this.chargeType = chargeType;
        this.quantity = quantity;
        this.unit = unit;
        this.widthCm = widthCm;
        this.heightCm = heightCm;
        this.unitPriceCents = unitPriceCents;
        this.areaPerPieceCm2 = areaPerPieceCm2;
        this.subtotalCents = subtotalCents;
    }

    public Long getId() {
        return id;
    }

    public String getDescription() {
        return description;
    }

    public ChargeType getChargeType() {
        return chargeType;
    }

    public int getQuantity() {
        return quantity;
    }

    public String getUnit() {
        return unit;
    }

    public Integer getWidthCm() {
        return widthCm;
    }

    public Integer getHeightCm() {
        return heightCm;
    }

    public long getUnitPriceCents() {
        return unitPriceCents;
    }

    public Long getAreaPerPieceCm2() {
        return areaPerPieceCm2;
    }

    public long getSubtotalCents() {
        return subtotalCents;
    }
}
