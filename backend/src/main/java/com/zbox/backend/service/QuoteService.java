package com.zbox.backend.service;

import com.zbox.backend.dto.PageResponse;
import com.zbox.backend.dto.QuoteCreateRequest;
import com.zbox.backend.dto.QuoteResponse;
import com.zbox.backend.dto.QuoteSummaryResponse;
import com.zbox.backend.enums.AuditEntity;
import com.zbox.backend.enums.CustomerStatus;
import com.zbox.backend.enums.ErrorCode;
import com.zbox.backend.enums.QuoteStatus;
import com.zbox.backend.exception.BusinessException;
import com.zbox.backend.mapper.QuoteMapper;
import com.zbox.backend.model.AuditLog;
import com.zbox.backend.model.Customer;
import com.zbox.backend.model.Quote;
import com.zbox.backend.repository.AuditLogRepository;
import com.zbox.backend.repository.CustomerRepository;
import com.zbox.backend.repository.QuoteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class QuoteService {

    private static final String QUOTE_SEQUENCE = "QUOTE";

    private final QuoteRepository quoteRepository;
    private final CustomerRepository customerRepository;
    private final NumberSequenceService numberSequenceService;
    private final AuditLogRepository auditLogRepository;
    private final QuoteMapper quoteMapper;
    private final UsuarioService usuarioService;

    public QuoteService(QuoteRepository quoteRepository, CustomerRepository customerRepository, NumberSequenceService numberSequenceService, AuditLogRepository auditLogRepository, QuoteMapper quoteMapper, UsuarioService usuarioService) {
        this.quoteRepository = quoteRepository;
        this.customerRepository = customerRepository;
        this.numberSequenceService = numberSequenceService;
        this.auditLogRepository = auditLogRepository;
        this.quoteMapper = quoteMapper;
        this.usuarioService = usuarioService;
    }

    private String getUserName(String login) {
        return usuarioService.buscarPorUsuario(login).getName();
    }

    @Transactional
    public QuoteResponse create(QuoteCreateRequest request, String login) {

        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new BusinessException(ErrorCode.CUSTOMER_NOT_FOUND, "Cliente não encontrado."));

        if (customer.getStatus() == CustomerStatus.INACTIVE) {
            throw new BusinessException(ErrorCode.CUSTOMER_INACTIVE, "Cliente inativo não pode receber orçamento.");
        }

        Quote quote = new Quote();

        quote.setNumber(numberSequenceService.next(QUOTE_SEQUENCE));
        quote.setVersion(1);
        quote.setStatus(QuoteStatus.DRAFT);
        quote.setCustomer(customer);
        quote.setSubtotalCents(0);
        quote.setDiscountCents(0);
        quote.setTotalCents(0);
        quote.setDiscountValue(0);
        quote.setCreatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);

        AuditLog auditLog = new AuditLog();
        auditLog.setEntityType(AuditEntity.QUOTE);
        auditLog.setEntityId(saved.getId());
        auditLog.setAction("CREATED");
        auditLog.setVersion(1);
        auditLog.setUserName(getUserName(login));
        auditLog.setCreatedAt(Instant.now());

        AuditLog savedLog = auditLogRepository.save(auditLog);

        return quoteMapper.toResponse(saved, 1, List.of(savedLog));
    }

    @Transactional(readOnly = true)
    public QuoteResponse findById(Long id, Integer version) {

        Quote quote = quoteRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.QUOTE_NOT_FOUND, "Orçamento não encontrado."));

        List<Quote> versions = quoteRepository.findByNumberOrderByVersionAsc(quote.getNumber());

        Quote selected = quote;

        if (version != null) {
            selected = null;

            for (Quote v : versions) {
                if (v.getVersion() == version) {
                    selected = v;
                    break;
                }
            }
        }
        if (selected == null) {
            throw new BusinessException(ErrorCode.QUOTE_VERSION_NOT_FOUND, "Versão do orçamento não encontrada.");
        }

        int latestVersion = versions.get(versions.size() - 1).getVersion();

        List<Long> ids = new ArrayList<>();
        for (Quote v : versions) {
            ids.add(v.getId());
        }

        List<AuditLog> events = auditLogRepository.findByEntityTypeAndEntityIdInOrderByCreatedAtAsc(AuditEntity.QUOTE, ids);

        return quoteMapper.toResponse(selected, latestVersion, events);
    }

    @Transactional(readOnly = true)
    public PageResponse<QuoteSummaryResponse> findAll(String search, String status, String period, Long customerId, int page, int size) {
        if (page < 0) {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "page não pode ser negativo.");
        }
        if (size < 1) {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "size deve ser no mínimo 1.");
        }

        QuoteStatus statusFilter = null;

        if (status != null && !status.isBlank()) {

            try {
                statusFilter = QuoteStatus.valueOf(status);
            } catch (IllegalArgumentException e) {
                throw new BusinessException(ErrorCode.INVALID_PARAMETER, "Status inválido.");
            }

            if (statusFilter == QuoteStatus.SUPERSEDED) {
                throw new BusinessException(ErrorCode.INVALID_PARAMETER, "Status inválido.");
            }
        }

        Instant since = null;

        if (period == null || period.isBlank() || period.equals("ALL")) {
            since = Instant.EPOCH;
        } else if (period.equals("LAST_30")) {
            since = Instant.now().minus(30, ChronoUnit.DAYS);
        } else if (period.equals("LAST_90")) {
            since = Instant.now().minus(90, ChronoUnit.DAYS);
        } else {
            throw new BusinessException(ErrorCode.INVALID_PARAMETER, "Período inválido.");
        }

        String searchFilter = null;

        if (search != null && search.trim().length() >= 2) {
            searchFilter = search.trim();
        }

        int safeSize = Math.min(size, 100);

        Pageable pageable = PageRequest.of(page, safeSize, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Page<Quote> result = quoteRepository.search(searchFilter, statusFilter, customerId, since, QuoteStatus.SUPERSEDED, pageable);

        Page<QuoteSummaryResponse> summaries = result.map(q -> quoteMapper.toSummary(q));
        return PageResponse.from(summaries);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> counts() {

        Map<String, Long> counts = new LinkedHashMap<>();

        counts.put("ALL", 0L);
        counts.put("DRAFT", 0L);
        counts.put("CONFIRMED", 0L);
        counts.put("SENT", 0L);
        counts.put("APPROVED", 0L);
        counts.put("REJECTED", 0L);
        counts.put("CANCELED", 0L);

        List<Object[]> rows = quoteRepository.countByStatus(QuoteStatus.SUPERSEDED);

        long all = 0;

        for (Object[] row : rows) {
            QuoteStatus s = (QuoteStatus) row[0];
            Long n = (Long) row[1];

            counts.put(s.name(), n);
            all += n;
        }
        counts.put("ALL", all);
        return counts;
    }
}

































