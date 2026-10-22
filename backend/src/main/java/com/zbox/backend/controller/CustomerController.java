package com.zbox.backend.controller;

import com.zbox.backend.dto.CustomerHistoryResponse;
import com.zbox.backend.dto.CustomerRequest;
import com.zbox.backend.dto.CustomerResponse;
import com.zbox.backend.dto.CustomerSummaryResponse;
import com.zbox.backend.dto.PageResponse;
import com.zbox.backend.enums.CustomerType;
import com.zbox.backend.service.CustomerService;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @PostMapping
    public ResponseEntity<CustomerResponse> create(@Valid @RequestBody CustomerRequest request, Authentication authentication) {
        CustomerResponse response = customerService.create(request, authentication.getName());
        return ResponseEntity.created(URI.create("/api/customers/" + response.getId())).body(response);
    }

    @GetMapping("/{id}")
    public CustomerResponse findById(@PathVariable Long id) {
        return customerService.findById(id);
    }

    @GetMapping("/{id}/history")
    public List<CustomerHistoryResponse> getHistory(@PathVariable Long id) {
        return customerService.getHistory(id);
    }

    @GetMapping("/duplicates")
    public List<CustomerSummaryResponse> findDuplicates(@RequestParam(required = false) String phone,
                                                        @RequestParam(required = false) String whatsapp,
                                                        @RequestParam(required = false) Long excludeId) {
        return customerService.findDuplicates(phone, whatsapp, excludeId);
    }

    @PutMapping("/{id}")
    public CustomerResponse update(@PathVariable Long id, @Valid @RequestBody CustomerRequest request, Authentication authentication) {
        return customerService.update(id, request, authentication.getName());
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public CustomerResponse deactivate(@PathVariable Long id, Authentication authentication) {
        return customerService.deactivate(id, authentication.getName());
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public CustomerResponse activate(@PathVariable Long id, Authentication authentication) {
        return customerService.activate(id, authentication.getName());
    }

    @GetMapping
    public PageResponse<CustomerSummaryResponse> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "ACTIVE") String status,
            @RequestParam(required = false) CustomerType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return customerService.findAll(search, status, type, page, size);
    }
}
