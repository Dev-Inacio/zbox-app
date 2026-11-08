package com.zbox.backend.util;

import com.zbox.backend.enums.ChargeType;
import com.zbox.backend.enums.DiscountType;
import com.zbox.backend.enums.ErrorCode;
import com.zbox.backend.exception.BusinessException;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class MoneyCalculator {

    private static final BigDecimal CM2_PER_M2 = BigDecimal.valueOf(10000);
    private static final BigDecimal PERCENT_SCALE = BigDecimal.valueOf(10000);
    private static final long MAX_PERCENT = 10000;

    private MoneyCalculator() {
    }

    public static long itemSubtotal(ChargeType chargeType, int quantity, Integer widthCm, Integer heightCm, long unitPriceCents) {

        if (chargeType == ChargeType.UNIT) {
            return quantity * unitPriceCents;
        }

        if (widthCm == null || heightCm == null) {
            throw new IllegalArgumentException("Largura e altura são obrigatórias para cobrança por área.");
        }

        BigDecimal quantityValue = BigDecimal.valueOf(quantity);
        BigDecimal widthValue = BigDecimal.valueOf(widthCm);
        BigDecimal heightValue = BigDecimal.valueOf(heightCm);
        BigDecimal unitPriceValue = BigDecimal.valueOf(unitPriceCents);

        BigDecimal quantityTimesWidth = quantityValue.multiply(widthValue);

        BigDecimal totalAreaCm2 = quantityTimesWidth.multiply(heightValue);

        BigDecimal rawTotal = totalAreaCm2.multiply(unitPriceValue);

        BigDecimal subtotal = rawTotal.divide(CM2_PER_M2, 0, RoundingMode.HALF_UP);

        return subtotal.longValueExact();
    }

    public static long discount(long subtotalCents, DiscountType type, long value) {
        if (value < 0) {
            throw new BusinessException(ErrorCode.DISCOUNT_NEGATIVE, "O desconto não pode ser negativo.");
        }

        if (type == DiscountType.PERCENT) {
            if (value > MAX_PERCENT) {
                throw new BusinessException(ErrorCode.DISCOUNT_PERCENT_OVER_100, "O desconto percentual não pode passar de 100%.");
            }

            BigDecimal subtotal = BigDecimal.valueOf(subtotalCents);
            BigDecimal percent = BigDecimal.valueOf(value);

            BigDecimal product = subtotal.multiply(percent);

            BigDecimal discountCents = product.divide(PERCENT_SCALE, 0, RoundingMode.HALF_UP);
            return discountCents.longValueExact();
        }

        if (value > subtotalCents) {
            throw new BusinessException(ErrorCode.DISCOUNT_GREATER_THAN_SUBTOTAL, "O desconto não pode ser maior que o subtotal.");
        }
        return value;
    }

    public static long total(long subtotalCents, long discountCents) {
        if (discountCents > subtotalCents) {
            throw new IllegalArgumentException("O desconto não pode ser maior que o subtotal.");
        }
        return subtotalCents - discountCents;
    }
}
