package com.zbox.backend.mapper;

import com.zbox.backend.dto.CompanyAddressRequest;
import com.zbox.backend.dto.CompanyAddressResponse;
import com.zbox.backend.dto.CompanyRequest;
import com.zbox.backend.dto.CompanyResponse;
import com.zbox.backend.model.Address;
import com.zbox.backend.model.Company;
import org.springframework.stereotype.Component;

@Component
public class CompanyMapper {

    public CompanyResponse toResponse(Company company) {

        Address address = company.getAddress();

        CompanyAddressResponse addressResponse = null;

        if (address != null) {
            addressResponse = new CompanyAddressResponse(
                    address.getZipCode(),
                    address.getStreet(),
                    address.getNumber(),
                    address.getComplement(),
                    address.getDistrict(),
                    address.getCity(),
                    address.getState());

        }
        return new CompanyResponse(company.getName(), company.getTagline(), company.getWhatsapp(), company.getPhone(), company.getUpdatedBy(), company.getUpdatedAt(), addressResponse);
    }

    public void updateEntity(Company company, CompanyRequest request) {

        company.setName(request.getName());
        company.setTagline(request.getTagline());
        company.setWhatsapp(request.getWhatsapp());
        company.setPhone(request.getPhone());

        CompanyAddressRequest req = request.getAddress();

        Address address = new Address();

        address.setZipCode(req.getCep());
        address.setStreet(req.getStreet());
        address.setNumber(req.getNumber());
        address.setComplement(req.getComplement());
        address.setDistrict(req.getDistrict());
        address.setCity(req.getCity());
        address.setState(req.getState());

        company.setAddress(address);

    }

    public CompanyResponse defaultResponse() {
        return new CompanyResponse("ZBOX",
                "Serralheria e esquadrias",
                null,
                null,
                null,
                null,
                null);
    }
}
