package com.zbox.backend.dto;

import com.zbox.backend.util.TextUtils;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class AddressRequest {

    @Pattern(regexp = "\\d{8}", message = "O CEP deve ter 8 dígitos, só números.")
    private String zipCode;

    @Size(max = 120, message = "A rua pode ter no máximo 120 caracteres.")
    private String street;

    @Size(max = 20, message = "O número pode ter no máximo 20 caracteres.")
    private String number;

    @Size(max = 120, message = "O complemento pode ter no máximo 120 caracteres.")
    private String complement;

    @Size(max = 120, message = "O bairro pode ter no máximo 120 caracteres.")
    private String district;

    @Size(max = 120, message = "A cidade pode ter no máximo 120 caracteres.")
    private String city;

    @Pattern(regexp = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO", message = "O estado deve ser uma UF válida, por exemplo SP.")
    private String state;

    public AddressRequest() {
    }

    public String getZipCode() {
        return zipCode;
    }

    public void setZipCode(String zipCode) {
        this.zipCode = TextUtils.blankToNull(zipCode);
    }

    public String getStreet() {
        return street;
    }

    public void setStreet(String street) {
        this.street = TextUtils.blankToNull(street);
    }

    public String getNumber() {
        return number;
    }

    public void setNumber(String number) {
        this.number = TextUtils.blankToNull(number);
    }

    public String getComplement() {
        return complement;
    }

    public void setComplement(String complement) {
        this.complement = TextUtils.blankToNull(complement);
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = TextUtils.blankToNull(district);
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = TextUtils.blankToNull(city);
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = TextUtils.blankToNull(state);
    }
}
