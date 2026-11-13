package com.zbox.backend.dto;

import com.zbox.backend.enums.QuoteStatus;

import java.time.Instant;

public class QuoteSummaryResponse {

    private final Long id;
    private final String number;
    private final int version;
    private final String customerName;
    private final Instant createdAt;
    private final long totalCents;
    private final QuoteStatus status;


    public QuoteSummaryResponse(Long id, String number, int version, String customerName, Instant createdAt, long totalCents, QuoteStatus status) {
        this.id = id;
        this.number = number;
        this.version = version;
        this.customerName = customerName;
        this.createdAt = createdAt;
        this.totalCents = totalCents;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getNumber() {
        return number;
    }

    public int getVersion() {
        return version;
    }

    public String getCustomerName() {
        return customerName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public long getTotalCents() {
        return totalCents;
    }

    public QuoteStatus getStatus() {
        return status;
    }
}
