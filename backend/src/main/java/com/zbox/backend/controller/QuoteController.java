package com.zbox.backend.controller;

import com.zbox.backend.dto.PageResponse;
import com.zbox.backend.dto.QuoteApproveRequest;
import com.zbox.backend.dto.QuoteCancelRequest;
import com.zbox.backend.dto.QuoteCreateRequest;
import com.zbox.backend.dto.QuoteDispatchRequest;
import com.zbox.backend.dto.QuoteRejectRequest;
import com.zbox.backend.dto.QuoteResponse;
import com.zbox.backend.dto.QuoteSummaryResponse;
import com.zbox.backend.dto.QuoteUpdateRequest;
import com.zbox.backend.dto.QuoteVersionRequest;
import com.zbox.backend.service.QuoteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @PutMapping("/{id}")
    public QuoteResponse update(@PathVariable Long id, @Valid @RequestBody QuoteUpdateRequest request, Authentication authentication) {
        return quoteService.update(id, request, authentication.getName());
    }

    @PostMapping("/{id}/confirm")
    public QuoteResponse confirm(@PathVariable Long id, Authentication authentication) {
        return quoteService.confirm(id, authentication.getName());
    }

    @PostMapping("/{id}/back-to-draft")
    public QuoteResponse backToDraft(@PathVariable Long id, Authentication authentication) {
        return quoteService.backToDraft(id, authentication.getName());
    }

    @PostMapping("/{id}/dispatches")
    public QuoteResponse dispatch(@PathVariable Long id, @Valid @RequestBody QuoteDispatchRequest request, Authentication authentication) {
        return quoteService.dispatch(id, request, authentication.getName());
    }

    @PostMapping("/{id}/approve")
    public QuoteResponse approve(@PathVariable Long id, @Valid @RequestBody QuoteApproveRequest request, Authentication authentication) {
        return quoteService.approve(id, request, authentication.getName());
    }


    @PostMapping("/{id}/reject")
    public QuoteResponse reject(@PathVariable Long id, @Valid @RequestBody QuoteRejectRequest request, Authentication authentication) {
        return quoteService.reject(id, request, authentication.getName());
    }

    @PostMapping("/{id}/cancel")
    public QuoteResponse cancel(@PathVariable Long id, @Valid @RequestBody QuoteCancelRequest request, Authentication authentication) {
        return quoteService.cancel(id, request, authentication.getName());
    }

    @PostMapping("/{id}/versions")
    public ResponseEntity<QuoteResponse> createVersion(@PathVariable Long id, @Valid @RequestBody(required = false) QuoteVersionRequest request, Authentication authentication) {
        QuoteResponse body = quoteService.createVersion(id, request, authentication.getName());
        return ResponseEntity.created(URI.create("/api/quotes/" + body.getId())).body(body);
    }
}
