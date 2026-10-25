package com.zbox.backend.dto;

import com.zbox.backend.enums.CustomerStatus;
import com.zbox.backend.enums.CustomerType;

public class CustomerSummaryResponse {

    private final Long id;
    private final String name;
    private final CustomerType type;
    private final String phone;
    private final String whatsapp;
    private final String city;
    private final String state;
    private final CustomerStatus status;

    public CustomerSummaryResponse(Long id, String name, CustomerType type, String phone, String whatsapp, String city, String state, CustomerStatus status) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.phone = phone;
        this.whatsapp = whatsapp;
        this.city = city;
        this.state = state;
        this.status = status;
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

    public String getCity() {
        return city;
    }

    public String getState() {
        return state;
    }

    public CustomerStatus getStatus() {
        return status;
    }
}
