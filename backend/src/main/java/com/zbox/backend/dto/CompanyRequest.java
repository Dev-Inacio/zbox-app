package com.zbox.backend.dto;

import com.zbox.backend.util.TextUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CompanyRequest {

    @NotBlank(message = "O nome da empresa é obrigatório.")
    @Size(min = 2, max = 60, message = "O nome deve ter entre 2 e 60 caracteres.")
    private String name;

    @Size(max = 60, message = "O slogan pode ter no máximo 60 caracteres.")
    private String tagline;

    @NotBlank(message = "O WhatsApp é obrigatório.")
    @Pattern(regexp = "\\d{10,11}", message = "O WhatsApp deve ter 10 ou 11 dígitos, só números.")
    private String whatsapp;

    @Pattern(regexp = "\\d{10,11}", message = "O telefone deve ter 10 ou 11 dígitos, só números.")
    private String phone;

    @NotNull(message = "O endereço é obrigatório.")
    @Valid
    private CompanyAddressRequest address;

    public CompanyRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = TextUtils.blankToNull(name);
    }

    public String getTagline() {
        return tagline;
    }

    public void setTagline(String tagline) {
        this.tagline = TextUtils.blankToNull(tagline);
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public void setWhatsapp(String whatsapp) {
        this.whatsapp = TextUtils.blankToNull(whatsapp);
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = TextUtils.blankToNull(phone);
    }

    public CompanyAddressRequest getAddress() {
        return address;
    }

    public void setAddress(CompanyAddressRequest address) {
        this.address = address;
    }
}
