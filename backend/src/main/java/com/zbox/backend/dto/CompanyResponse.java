package com.zbox.backend.dto;

import java.time.Instant;

public class CompanyResponse {

    private final String name;
    private final String tagline;
    private final String whatsapp;
    private final String phone;
    private final String updatedBy;
    private final Instant updatedAt;
    private final CompanyAddressResponse address;

    public CompanyResponse(String name, String tagline, String whatsapp, String phone, String updatedBy, Instant updatedAt, CompanyAddressResponse address) {
        this.name = name;
        this.tagline = tagline;
        this.whatsapp = whatsapp;
        this.phone = phone;
        this.updatedBy = updatedBy;
        this.updatedAt = updatedAt;
        this.address = address;
    }

    public String getName() {
        return name;
    }

    public String getTagline() {
        return tagline;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public String getPhone() {
        return phone;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public CompanyAddressResponse getAddress() {
        return address;
    }
}
