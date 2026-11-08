package com.zbox.backend.dto;

public class QuoteOrderResponse {

    private final Long id;
    private final String number;

    public QuoteOrderResponse(Long id, String number) {
        this.id = id;
        this.number = number;
    }

    public Long getId() {
        return id;
    }

    public String getNumber() {
        return number;
    }
}
