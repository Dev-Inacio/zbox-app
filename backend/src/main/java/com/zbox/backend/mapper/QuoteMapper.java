package com.zbox.backend.mapper;

import com.zbox.backend.dto.QuoteCustomerResponse;
import com.zbox.backend.dto.QuoteEventResponse;
import com.zbox.backend.dto.QuoteItemResponse;
import com.zbox.backend.dto.QuoteResponse;
import com.zbox.backend.dto.QuoteSummaryResponse;
import com.zbox.backend.enums.ChargeType;
import com.zbox.backend.model.Address;
import com.zbox.backend.model.AuditLog;
import com.zbox.backend.model.Customer;
import com.zbox.backend.model.Quote;
import com.zbox.backend.model.QuoteItem;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class QuoteMapper {

    private String buildAddressLine(Address address) {

        if (address == null) {
            return null;
        }

        List<String> parts = new ArrayList<>();

        if (address.getStreet() != null) {
            String streetPart = address.getStreet();
            if (address.getNumber() != null) {
                streetPart = address.getStreet() + ", " + address.getNumber();
            }
            parts.add(streetPart);
        }

        if (address.getDistrict() != null) {
            parts.add(address.getDistrict());
        }

        if (address.getCity() != null) {
            String cityPart = address.getCity();
            if (address.getState() != null) {
                cityPart = address.getCity() + "/" + address.getState();
            }
            parts.add(cityPart);
        }
        if (parts.isEmpty()) {
            return null;
        }
        return String.join(" · ", parts);
    }

    public QuoteResponse toResponse(Quote quote, int latestVersion, List<AuditLog> events) {
        List<QuoteItemResponse> itemResponses = new ArrayList<>();

        for (QuoteItem item : quote.getItems()) {
            itemResponses.add(toItemResponse(item));
        }

        List<QuoteEventResponse> eventResponses = new ArrayList<>();

        for (AuditLog log : events) {
            eventResponses.add(toEventResponse(log));
        }

        QuoteCustomerResponse customerResponse = toCustomerResponse(quote.getCustomer());

        return new QuoteResponse(quote.getId(),
                quote.getNumber(),
                quote.getVersion(),
                latestVersion,
                quote.getStatus(),
                customerResponse,
                itemResponses,
                quote.getSubtotalCents(),
                quote.getDiscountType(),
                quote.getDiscountValue(),
                quote.getDiscountCents(),
                quote.getTotalCents(),
                quote.getPaymentTerms(),
                quote.getNotes(),
                quote.getVersionReason(),
                quote.getCreatedAt(),
                quote.getUpdatedAt(),
                quote.getConfirmedAt(),
                quote.getSentAt(),
                quote.getDecidedAt(),
                quote.getApprovalMethod(),
                quote.getRejectionReason(),
                quote.getDecisionNote(),
                eventResponses,
                null);
    }

    private QuoteItemResponse toItemResponse(QuoteItem item) {
        Long areaPerPiece = null;

        if (item.getChargeType() == ChargeType.AREA) {
            areaPerPiece = (long) item.getWidthCm() * item.getHeightCm();
        }
        return new QuoteItemResponse(
                item.getId(),
                item.getDescription(),
                item.getChargeType(),
                item.getQuantity(),
                item.getUnit(),
                item.getWidthCm(),
                item.getHeightCm(),
                item.getUnitPriceCents(),
                areaPerPiece,
                item.getSubtotalCents());
    }

    private QuoteEventResponse toEventResponse(AuditLog log) {
        return new QuoteEventResponse(log.getId(), log.getAction(), log.getVersion(), log.getDetail(), log.getUserName(), log.getCreatedAt());
    }

    private QuoteCustomerResponse toCustomerResponse(Customer customer) {
        return new QuoteCustomerResponse(customer.getId(),
                customer.getName(),
                customer.getWhatsapp(),
                customer.getPhone(),
                buildAddressLine(customer.getAddress()));
    }

    public QuoteSummaryResponse toSummary(Quote quote) {
        String customerName = quote.getCustomer().getName();

        return new QuoteSummaryResponse(quote.getId(),
                quote.getNumber(),
                quote.getVersion(),
                customerName,
                quote.getCreatedAt(),
                quote.getTotalCents(),
                quote.getStatus());
    }
}
