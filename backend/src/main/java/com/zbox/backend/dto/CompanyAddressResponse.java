package com.zbox.backend.dto;

public class CompanyAddressResponse {

    private final String cep;
    private final String street;
    private final String number;
    private final String complement;
    private final String district;
    private final String city;
    private final String state;

    public CompanyAddressResponse(String cep, String street, String number, String complement, String district, String city, String state) {
        this.cep = cep;
        this.street = street;
        this.number = number;
        this.complement = complement;
        this.district = district;
        this.city = city;
        this.state = state;
    }

    public String getCep() {
        return cep;
    }

    public String getStreet() {
        return street;
    }

    public String getNumber() {
        return number;
    }

    public String getComplement() {
        return complement;
    }

    public String getDistrict() {
        return district;
    }

    public String getCity() {
        return city;
    }

    public String getState() {
        return state;
    }
}
