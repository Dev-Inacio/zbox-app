package com.zbox.backend.service;

import com.zbox.backend.dto.AddressRequest;
import com.zbox.backend.dto.CustomerHistoryResponse;
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

import com.zbox.backend.model.Address;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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

    private boolean addressChanged(Address current, AddressRequest requested) {
        if (current == null) {
            current = new Address();
        }

        if (requested == null) {
            requested = new AddressRequest();
        }
        return !Objects.equals(current.getZipCode(), requested.getZipCode()) ||
                !Objects.equals(current.getStreet(), requested.getStreet()) ||
                !Objects.equals(current.getNumber(), requested.getNumber()) ||
                !Objects.equals(current.getComplement(), requested.getComplement()) ||
                !Objects.equals(current.getDistrict(), requested.getDistrict()) ||
                !Objects.equals(current.getCity(), requested.getCity()) ||
                !Objects.equals(current.getState(), requested.getState());
    }

    public CustomerResponse findById(Long id) {
        Customer customer = getCustomerOrThrow(id);

        return customerMapper.toResponse(customer);
    }

    @Transactional
    public CustomerResponse update(Long id, CustomerRequest request, String login) {
        Customer customer = getCustomerOrThrow(id);
        List<String> changed = new ArrayList<>();

        if (!Objects.equals(customer.getName(), request.getName())) {
            changed.add("name");
        }

        if (!Objects.equals(customer.getType(), request.getType())) {
            changed.add("type");
        }

        if (!Objects.equals(customer.getPhone(), request.getPhone())) {
            changed.add("phone");
        }

        if (!Objects.equals(customer.getWhatsapp(), request.getWhatsapp())) {
            changed.add("whatsapp");
        }

        if (!Objects.equals(customer.getNotes(), request.getNotes())) {
            changed.add("notes");
        }

        if (addressChanged(customer.getAddress(), request.getAddress())) {
            changed.add("address");
        }

        customerMapper.updateEntity(request, customer);

        customer.setUpdatedAt(Instant.now());
        Customer salvo = customerRepository.save(customer);

        if (!changed.isEmpty()) {
            saveLog(salvo.getId(), CustomerAction.UPDATED, String.join(",", changed), login);
        }

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

    public List<CustomerHistoryResponse> getHistory(Long id) {
        getCustomerOrThrow(id);

        List<CustomerAuditLog> logs = customerAuditLogRepository.findByCustomerIdOrderByCreatedAtDesc(id);

        List<CustomerHistoryResponse> history = new ArrayList<>();

        for (CustomerAuditLog log : logs) {
            history.add(customerMapper.toHistoryResponse(log));
        }
        return history;
    }
}
