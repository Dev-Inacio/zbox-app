package com.zbox.backend.service;

import com.zbox.backend.dto.CompanyAddressRequest;
import com.zbox.backend.dto.CompanyRequest;
import com.zbox.backend.dto.CompanyResponse;
import com.zbox.backend.enums.AuditEntity;
import com.zbox.backend.mapper.CompanyMapper;
import com.zbox.backend.model.Address;
import com.zbox.backend.model.AuditLog;
import com.zbox.backend.model.Company;
import com.zbox.backend.repository.AuditLogRepository;
import com.zbox.backend.repository.CompanyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class CompanyService {

    private static final Long COMPANY_ID = 1L;

    private final CompanyRepository companyRepository;
    private final CompanyMapper companyMapper;
    private final AuditLogRepository auditLogRepository;
    private final UsuarioService usuarioService;

    public CompanyService(CompanyRepository companyRepository, CompanyMapper companyMapper, AuditLogRepository auditLogRepository, UsuarioService usuarioService) {
        this.companyRepository = companyRepository;
        this.companyMapper = companyMapper;
        this.auditLogRepository = auditLogRepository;
        this.usuarioService = usuarioService;
    }

    public CompanyResponse get() {
        Optional<Company> company = companyRepository.findById(COMPANY_ID);

        if (company.isEmpty()) {
            return companyMapper.defaultResponse();
        }
        return companyMapper.toResponse(company.get());
    }

    @Transactional
    public CompanyResponse update(CompanyRequest companyRequest, String login) {
        Optional<Company> found = companyRepository.findById(COMPANY_ID);

        boolean isNew = found.isEmpty();

        Company company;

        if (isNew) {
            company = new Company();
            company.setId(COMPANY_ID);
        } else {
            company = found.get();
        }

        List<String> changes = new ArrayList<>();

        Address current = company.getAddress();
        CompanyAddressRequest req = companyRequest.getAddress();

        addChange(changes, "name", company.getName(), companyRequest.getName());
        addChange(changes, "tagline", company.getTagline(), companyRequest.getTagline());
        addChange(changes, "whatsapp", company.getWhatsapp(), companyRequest.getWhatsapp());
        addChange(changes, "phone", company.getPhone(), companyRequest.getPhone());

        addChange(changes, "cep",
                current == null ? null : current.getZipCode(),
                req.getCep());

        addChange(changes, "street",
                current == null ? null : current.getStreet(),
                req.getStreet());

        addChange(changes, "number",
                current == null ? null : current.getNumber(),
                req.getNumber());

        addChange(changes, "complement",
                current == null ? null : current.getComplement(),
                req.getComplement());

        addChange(changes, "district",
                current == null ? null : current.getDistrict(),
                req.getDistrict());

        addChange(changes, "city",
                current == null ? null : current.getCity(),
                req.getCity());

        addChange(changes, "state",
                current == null ? null : current.getState(),
                req.getState());


        if (changes.isEmpty() && !isNew) {
            return companyMapper.toResponse(company);
        }
        companyMapper.updateEntity(company, companyRequest);

        String userName = getUserName(login);

        company.setUpdatedAt(Instant.now());
        company.setUpdatedBy(userName);

        Company saved = companyRepository.save(company);

        AuditLog log = new AuditLog();

        log.setEntityType(AuditEntity.COMPANY);
        log.setEntityId(COMPANY_ID);
        log.setAction(isNew ? "CREATED" : "UPDATED");
        log.setUserName(userName);
        log.setCreatedAt(Instant.now());

        String detail = String.join("; ", changes);

        if (detail.length() > 2000) {
            detail = detail.substring(0, 2000);
        }
        log.setDetail(detail);

        auditLogRepository.save(log);
        return companyMapper.toResponse(saved);
    }

    private String getUserName(String login) {
        return usuarioService.buscarPorUsuario(login).getName();
    }

    private void addChange(List<String> changes, String field, String before, String after) {
        if (!Objects.equals(before, after)) {
            changes.add(field + ": " + before + " → " + after);
        }
    }
}
