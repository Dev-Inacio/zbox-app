package com.zbox.backend.service;

import com.zbox.backend.dto.CustomerRequest;
import com.zbox.backend.dto.CustomerResponse;
import com.zbox.backend.dto.CustomerSummaryResponse;
import com.zbox.backend.dto.PageResponse;
import com.zbox.backend.enums.CustomerAction;
import com.zbox.backend.enums.CustomerStatus;
import com.zbox.backend.enums.CustomerType;
import com.zbox.backend.enums.ErrorCode;
import com.zbox.backend.exception.BusinessException;
import com.zbox.backend.mapper.CustomerMapper;

import com.zbox.backend.model.Customer;
import com.zbox.backend.model.CustomerAuditLog;
import com.zbox.backend.repository.CustomerAuditLogRepository;
import com.zbox.backend.repository.CustomerRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;
    private final UsuarioService usuarioService;
    private final CustomerAuditLogRepository customerAuditLogRepository;

    public CustomerService(CustomerRepository customerRepository, CustomerMapper customerMapper, UsuarioService usuarioService, CustomerAuditLogRepository customerAuditLogRepository) {
        this.customerRepository = customerRepository;
        this.customerMapper = customerMapper;
        this.usuarioService = usuarioService;
        this.customerAuditLogRepository = customerAuditLogRepository;
    }

    private Customer getCustomerOrThrow(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.CUSTOMER_NOT_FOUND, "Cliente não encontrado."));
    }

    private String getUserName(String login) {
        return usuarioService.buscarPorUsuario(login).getName();
    }

    @Transactional
    public CustomerResponse create(CustomerRequest request, String login) {
        Customer customer = customerMapper.toEntity(request);
        customer.setStatus(CustomerStatus.ACTIVE);

        Instant now = Instant.now();
        customer.setCreatedAt(now);
        customer.setUpdatedAt(now);

        Customer salvo = customerRepository.save(customer);
        saveLog(salvo.getId(), CustomerAction.CREATED, null, login);

        return customerMapper.toResponse(salvo);
    }

    public CustomerResponse findById(Long id) {
        Customer customer = getCustomerOrThrow(id);

        return customerMapper.toResponse(customer);
    }

    public CustomerResponse update(Long id, CustomerRequest request) {
        Customer customer = getCustomerOrThrow(id);
        customerMapper.updateEntity(request, customer);

        customer.setUpdatedAt(Instant.now());
        Customer salvo = customerRepository.save(customer);

        return customerMapper.toResponse(salvo);
    }

    @Transactional
    public CustomerResponse deactivate(Long id, String login) {
        Customer customer = getCustomerOrThrow(id);
        if (customer.getStatus() == CustomerStatus.INACTIVE) {
            throw new BusinessException(ErrorCode.CUSTOMER_ALREADY_INACTIVE, "Cliente já está inativo.");
        }
        customer.setStatus(CustomerStatus.INACTIVE);
        Instant now = Instant.now();
        customer.setDeactivatedAt(now);
        customer.setDeactivatedBy(getUserName(login));
        customer.setUpdatedAt(now);

        Customer salvo = customerRepository.save(customer);
        saveLog(salvo.getId(), CustomerAction.DEACTIVATED, null, login);
        return customerMapper.toResponse(salvo);
    }

    @Transactional
    public CustomerResponse activate(Long id, String login) {
        Customer customer = getCustomerOrThrow(id);
        if (customer.getStatus() == CustomerStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.CUSTOMER_ALREADY_ACTIVE, "Cliente já está ativo.");
        }
        customer.setStatus(CustomerStatus.ACTIVE);
        Instant now = Instant.now();
        customer.setDeactivatedAt(null);
        customer.setDeactivatedBy(null);
        customer.setUpdatedAt(now);

        Customer salvo = customerRepository.save(customer);

        saveLog(salvo.getId(), CustomerAction.ACTIVATED, null, login);

        return customerMapper.toResponse(salvo);
    }

    public PageResponse<CustomerSummaryResponse> findAll(String search, String status, CustomerType type, int page, int size) {

        if (page < 0) {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "page não pode ser negativo.");
        }

        if (!status.equals("ACTIVE") && !status.equals("INACTIVE") && !status.equals("ALL")) {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "status deve ser ACTIVE, INACTIVE ou ALL.");
        }

        if (size < 1) {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "size deve ser no mínimo 1.");
        }

        String searchFilter = null;
        if (search != null && search.trim().length() >= 2) {
            searchFilter = search.trim();
        }

        CustomerStatus statusFilter = null;
        if (!status.equals("ALL")) {
            statusFilter = CustomerStatus.valueOf(status);
        }

        int safeSize = Math.min(size, 100);

        Pageable pageable = PageRequest.of(page, safeSize, Sort.by("name").and(Sort.by("id")));

        Page<Customer> result = customerRepository.search(searchFilter, statusFilter, type, pageable);

        Page<CustomerSummaryResponse> summaries = result.map(customer -> customerMapper.toSummary(customer));
        return PageResponse.from(summaries);
    }

    private void saveLog(Long customerId, CustomerAction action, String changedFields, String login) {
        CustomerAuditLog log = new CustomerAuditLog();
        log.setCustomerId(customerId);
        log.setAction(action);
        log.setChangedFields(changedFields);
        log.setUserName(getUserName(login));
        log.setCreatedAt(Instant.now());
        customerAuditLogRepository.save(log);
    }
}
