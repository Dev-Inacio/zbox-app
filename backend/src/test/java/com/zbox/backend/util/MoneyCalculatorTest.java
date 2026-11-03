package com.zbox.backend.util;

import com.zbox.backend.enums.ChargeType;
import com.zbox.backend.enums.DiscountType;
import com.zbox.backend.enums.ErrorCode;
import com.zbox.backend.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class MoneyCalculatorTest {

    @Test
    public void itemSubtotalAreaDuasPecas() {
        long resultado = MoneyCalculator.itemSubtotal(ChargeType.AREA, 2, 120, 100, 85000);
        assertEquals(204000L, resultado);
    }

    @Test
    public void itemSubtotalAreaArredondaParaBaixo() {
        long resultado = MoneyCalculator.itemSubtotal(ChargeType.AREA, 1, 50, 50, 85001);
        assertEquals(21250L, resultado);
    }

    @Test
    public void descontoPercentualETotal() {
        long resultado = MoneyCalculator.discount(354000, DiscountType.PERCENT, 500);
        assertEquals(17700L, resultado);

        long resultado2 = MoneyCalculator.total(354000, 17700);
        assertEquals(336300L, resultado2);
    }

    @Test
    public void descontoPercentualArredondaMetade() {
        long resultado = MoneyCalculator.discount(100, DiscountType.PERCENT, 1250);
        assertEquals(13L, resultado);
    }

    @Test
    public void descontoMaiorQueSubtotalLancaErro() {
        BusinessException exception = assertThrows(BusinessException.class, () -> MoneyCalculator.discount(300000, DiscountType.AMOUNT, 350000));
        assertEquals(ErrorCode.DISCOUNT_GREATER_THAN_SUBTOTAL, exception.getErrorCode());
    }
}
