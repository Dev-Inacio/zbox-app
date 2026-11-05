package com.zbox.backend.dto;

import com.zbox.backend.enums.ApprovalMethod;
import com.zbox.backend.enums.DiscountType;
import com.zbox.backend.enums.QuoteStatus;
import com.zbox.backend.enums.RejectionReason;

import java.time.Instant;
import java.util.List;

public class QuoteResponse {
    private final Long id;
    private final String number;
    private final int version;
    private final int latestVersion;
    private final QuoteStatus status;
    private final QuoteCustomerResponse customer;
    private final List<QuoteItemResponse> items;
    private final long subtotalCents;
    private final DiscountType discountType;
    private final long discountValue;
    private final long discountCents;
    private final long totalCents;
    private final String paymentTerms;
    private final String notes;
    private final String versionReason;
    private final Instant createdAt;
    private final Instant updatedAt;
    private final Instant confirmedAt;
    private final Instant sentAt;
    private final Instant decidedAt;
    private final ApprovalMethod approvalMethod;
    private final RejectionReason rejectionReason;
    private final String decisionNote;
    private final List<QuoteEventResponse> events;
    private final QuoteOrderResponse order;

    public QuoteResponse(Long id, String number, int version, int latestVersion, QuoteStatus status, QuoteCustomerResponse customer, List<QuoteItemResponse> items, long subtotalCents, DiscountType discountType, long discountValue, long discountCents, long totalCents, String paymentTerms, String notes, String versionReason, Instant createdAt, Instant updatedAt, Instant confirmedAt, Instant sentAt, Instant decidedAt, ApprovalMethod approvalMethod, RejectionReason rejectionReason, String decisionNote, List<QuoteEventResponse> events, QuoteOrderResponse order) {
        this.id = id;
        this.number = number;
        this.version = version;
        this.latestVersion = latestVersion;
        this.status = status;
        this.customer = customer;
        this.items = items;
        this.subtotalCents = subtotalCents;
        this.discountType = discountType;
        this.discountValue = discountValue;
        this.discountCents = discountCents;
        this.totalCents = totalCents;
        this.paymentTerms = paymentTerms;
        this.notes = notes;
        this.versionReason = versionReason;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.confirmedAt = confirmedAt;
        this.sentAt = sentAt;
        this.decidedAt = decidedAt;
        this.approvalMethod = approvalMethod;
        this.rejectionReason = rejectionReason;
        this.decisionNote = decisionNote;
        this.events = events;
        this.order = order;
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

    public int getLatestVersion() {
        return latestVersion;
    }

    public QuoteStatus getStatus() {
        return status;
    }

    public QuoteCustomerResponse getCustomer() {
        return customer;
    }

    public List<QuoteItemResponse> getItems() {
        return items;
    }

    public long getSubtotalCents() {
        return subtotalCents;
    }

    public DiscountType getDiscountType() {
        return discountType;
    }

    public long getDiscountValue() {
        return discountValue;
    }

    public long getDiscountCents() {
        return discountCents;
    }

    public long getTotalCents() {
        return totalCents;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public String getNotes() {
        return notes;
    }

    public String getVersionReason() {
        return versionReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public ApprovalMethod getApprovalMethod() {
        return approvalMethod;
    }

    public RejectionReason getRejectionReason() {
        return rejectionReason;
    }

    public String getDecisionNote() {
        return decisionNote;
    }

    public List<QuoteEventResponse> getEvents() {
        return events;
    }

    public QuoteOrderResponse getOrder() {
        return order;
    }
}
