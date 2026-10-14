package com.zbox.backend.dto;

import com.zbox.backend.enums.CustomerType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CustomerRequest {

    @NotBlank(message = "O nome é obrigatório.")
    @Size(min = 3,max = 120, message = "O nome precisa ter entre 3 e 120 caracteres.")
    private String name;

    private CustomerType type;

    @Pattern(regexp = "\\d{10,11}", message = "O telefone deve ter 10 ou 11 dígitos, só números.")
    private String phone;

    @Pattern(regexp = "\\d{11}", message = "O WhatsApp deve ter 11 dígitos, só números.")
    private String whatsapp;

    @Valid
    private AddressRequest address;

    @Size(max = 500, message = "As observações podem ter no máximo 500 caracteres.")
    private String notes;

    public CustomerRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public CustomerType getType() {
        return type;
    }

    public void setType(CustomerType type) {
        this.type = type;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public void setWhatsapp(String whatsapp) {
        this.whatsapp = whatsapp;
    }

    public AddressRequest getAddress() {
        return address;
    }

    public void setAddress(AddressRequest address) {
        this.address = address;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
