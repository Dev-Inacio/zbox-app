package com.zbox.backend.dto;

public class QuoteCustomerResponse {
    private final Long id;
    private final String name;
    private final String whatsapp;
    private final String phone;
    private final String addressLine;

    public QuoteCustomerResponse(Long id, String name, String whatsapp, String phone, String addressLine) {
        this.id = id;
        this.name = name;
        this.whatsapp = whatsapp;
        this.phone = phone;
        this.addressLine = addressLine;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public String getPhone() {
        return phone;
    }

    public String getAddressLine() {
        return addressLine;
    }
}
