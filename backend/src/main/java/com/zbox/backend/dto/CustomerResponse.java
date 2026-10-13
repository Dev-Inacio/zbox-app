package com.zbox.backend.dto;

import com.zbox.backend.enums.CustomerStatus;
import com.zbox.backend.enums.CustomerType;

import java.time.Instant;

public class CustomerResponse {

    private final Long id;

    private final String name;

    private final CustomerType type;

    private final String phone;

    private final String whatsapp;

    private final AddressRequest address;

    private final String notes;

    private final CustomerStatus status;

    private final Instant createdAt;

    private final Instant updatedAt;

    private final Instant deactivatedAt;

    private final String deactivatedBy;

    public CustomerResponse(Long id, String name, CustomerType type, String phone, String whatsapp, AddressRequest address, String notes, CustomerStatus status, Instant createdAt, Instant updatedAt, Instant deactivatedAt, String deactivatedBy) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.phone = phone;
        this.whatsapp = whatsapp;
        this.address = address;
        this.notes = notes;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deactivatedAt = deactivatedAt;
        this.deactivatedBy = deactivatedBy;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public CustomerType getType() {
        return type;
    }

    public String getPhone() {
        return phone;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public AddressRequest getAddress() {
        return address;
    }

    public String getNotes() {
        return notes;
    }

    public CustomerStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeactivatedAt() {
        return deactivatedAt;
    }

    public String getDeactivatedBy() {
        return deactivatedBy;
    }
}
