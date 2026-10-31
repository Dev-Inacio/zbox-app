package com.zbox.backend.controller;

import com.zbox.backend.dto.CompanyRequest;
import com.zbox.backend.dto.CompanyResponse;
import com.zbox.backend.service.CompanyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/company")
public class CompanyController {
    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

    @GetMapping
    public ResponseEntity<CompanyResponse> get() {
        return ResponseEntity.ok(companyService.get());
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<CompanyResponse> update(@Valid @RequestBody CompanyRequest request, Authentication authentication) {
        return ResponseEntity.ok(companyService.update(request, authentication.getName()));
    }
}
