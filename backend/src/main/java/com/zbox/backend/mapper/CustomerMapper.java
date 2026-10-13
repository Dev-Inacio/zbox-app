package com.zbox.backend.mapper;

import com.zbox.backend.dto.AddressRequest;
import com.zbox.backend.dto.CustomerRequest;
import com.zbox.backend.dto.CustomerResponse;
import com.zbox.backend.model.Address;
import com.zbox.backend.model.Customer;
import org.springframework.stereotype.Component;

@Component
public class CustomerMapper {
    public Customer toEntity(CustomerRequest request) {
        Customer customer = new Customer();

        customer.setName(request.getName());
        customer.setType(request.getType());
        customer.setPhone(request.getPhone());
        customer.setWhatsapp(request.getWhatsapp());
        customer.setNotes(request.getNotes());
        customer.setAddress(toAddress(request.getAddress()));

        return customer;
    }

    public CustomerResponse toResponse(Customer customer) {
        return new CustomerResponse(customer.getId(),
                customer.getName(),
                customer.getType(),
                customer.getPhone(),
                customer.getWhatsapp(),
                toAddressRequest(customer.getAddress()),
                customer.getNotes(),
                customer.getStatus(),
                customer.getCreatedAt(),
                customer.getUpdatedAt(),
                customer.getDeactivatedAt(),
                customer.getDeactivatedBy());
    }

    private AddressRequest toAddressRequest(Address address) {
        if (address == null) {
            return null;
        }

        AddressRequest dto = new AddressRequest();

        dto.setZipCode(address.getZipCode());
        dto.setStreet(address.getStreet());
        dto.setNumber(address.getNumber());
        dto.setComplement(address.getComplement());
        dto.setDistrict(address.getDistrict());
        dto.setCity(address.getCity());
        dto.setState(address.getState());

        return dto;
    }

    private Address toAddress(AddressRequest request) {
        if (request == null) {
            return null;
        }

        Address address = new Address();

        address.setZipCode(request.getZipCode());
        address.setStreet(request.getStreet());
        address.setNumber(request.getNumber());
        address.setComplement(request.getComplement());
        address.setDistrict(request.getDistrict());
        address.setCity(request.getCity());
        address.setState(request.getState());

        return address;
    }

    public void updateEntity(CustomerRequest request, Customer customer) {

        customer.setName(request.getName());
        customer.setType(request.getType());
        customer.setPhone(request.getPhone());
        customer.setWhatsapp(request.getWhatsapp());
        customer.setNotes(request.getNotes());
        customer.setAddress(toAddress(request.getAddress()));
    }
}
