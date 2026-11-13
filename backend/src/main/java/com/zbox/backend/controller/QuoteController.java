package com.zbox.backend.controller;

import com.zbox.backend.dto.PageResponse;
import com.zbox.backend.dto.QuoteCreateRequest;
import com.zbox.backend.dto.QuoteResponse;
import com.zbox.backend.dto.QuoteSummaryResponse;
import com.zbox.backend.service.QuoteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private final QuoteService quoteService;

    public QuoteController(QuoteService quoteService) {
        this.quoteService = quoteService;
    }

    @PostMapping
    public ResponseEntity<QuoteResponse> create(@Valid @RequestBody QuoteCreateRequest request, Authentication authentication) {

        QuoteResponse quoteResponse = quoteService.create(request, authentication.getName());

        return ResponseEntity.created(URI.create("/api/quotes/" + quoteResponse.getId())).body(quoteResponse);
    }

    @GetMapping("/{id}")
    public QuoteResponse findById(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        return quoteService.findById(id, version);
    }

    @GetMapping
    public PageResponse<QuoteSummaryResponse> findAll(@RequestParam(required = false) String search,
                                                      @RequestParam(required = false) String status,
                                                      @RequestParam(required = false) String period,
                                                      @RequestParam(required = false) Long customerId,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
        return quoteService.findAll(search, status, period, customerId, page, size);
    }

    @GetMapping("/counts")
    public Map<String, Long> counts() {
        return quoteService.counts();
    }
}
