package com.zbox.backend.service;

import com.zbox.backend.dto.PageResponse;
import com.zbox.backend.dto.QuoteApproveRequest;
import com.zbox.backend.dto.QuoteCreateRequest;
import com.zbox.backend.dto.QuoteDispatchRequest;
import com.zbox.backend.dto.QuoteItemRequest;
import com.zbox.backend.dto.QuoteRejectRequest;
import com.zbox.backend.dto.QuoteResponse;
import com.zbox.backend.dto.QuoteSummaryResponse;
import com.zbox.backend.dto.QuoteUpdateRequest;
import com.zbox.backend.enums.AuditEntity;
import com.zbox.backend.enums.ChargeType;
import com.zbox.backend.enums.CustomerStatus;
import com.zbox.backend.enums.ErrorCode;
import com.zbox.backend.enums.QuoteStatus;
import com.zbox.backend.exception.BusinessException;
import com.zbox.backend.mapper.QuoteMapper;
import com.zbox.backend.model.AuditLog;
import com.zbox.backend.model.Customer;
import com.zbox.backend.model.Quote;
import com.zbox.backend.model.QuoteItem;
import com.zbox.backend.repository.AuditLogRepository;
import com.zbox.backend.repository.CustomerRepository;
import com.zbox.backend.repository.QuoteRepository;
import com.zbox.backend.util.MoneyCalculator;
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

    private Quote getQuoteOrThrow(Long id) {
        return quoteRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.QUOTE_NOT_FOUND, "Orçamento não encontrado."));
    }

    private QuoteResponse buildResponse(Quote quote) {
        List<Quote> versions = quoteRepository.findByNumberOrderByVersionAsc(quote.getNumber());

        int latestVersion = versions.get(versions.size() - 1).getVersion();

        List<Long> ids = new ArrayList<>();

        for (Quote v : versions) {
            ids.add(v.getId());
        }

        List<AuditLog> events = auditLogRepository.findByEntityTypeAndEntityIdInOrderByCreatedAtAsc(AuditEntity.QUOTE, ids);

        return quoteMapper.toResponse(quote, latestVersion, events);
    }

    private void saveLog(Quote quote, String action, String detail, String login) {
        AuditLog auditLog = new AuditLog();

        auditLog.setEntityType(AuditEntity.QUOTE);
        auditLog.setEntityId(quote.getId());
        auditLog.setAction(action);
        auditLog.setDetail(detail);
        auditLog.setVersion(quote.getVersion());
        auditLog.setUserName(getUserName(login));
        auditLog.setCreatedAt(Instant.now());

        auditLogRepository.save(auditLog);
    }

    private void requireStatus(Quote quote, QuoteStatus... allowed) {
        for (QuoteStatus status : allowed) {
            if (quote.getStatus() == status) {
                return;
            }
        }
        throw new BusinessException(ErrorCode.INVALID_QUOTE_STATUS_TRANSITION, "Operação não permitida para o status atual do orçamento.");
    }

    @Transactional
    public QuoteResponse confirm(Long id, String login) {
        Quote quote = getQuoteOrThrow(id);
        if (quote.getStatus() == QuoteStatus.CONFIRMED) {
            return buildResponse(quote);
        }

        requireStatus(quote, QuoteStatus.DRAFT);

        if (quote.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.QUOTE_CANNOT_BE_CONFIRMED, "O orçamento precisa ter ao menos um item.");
        }

        if (quote.getTotalCents() <= 0) {
            throw new BusinessException(ErrorCode.QUOTE_CANNOT_BE_CONFIRMED, "O total do orçamento precisa ser maior que zero.");
        }

        if (quote.getCustomer().getStatus() == CustomerStatus.INACTIVE) {
            throw new BusinessException(ErrorCode.QUOTE_CANNOT_BE_CONFIRMED, "Cliente inativo não pode ter orçamento confirmado.");
        }

        quote.setStatus(QuoteStatus.CONFIRMED);
        quote.setConfirmedAt(Instant.now());
        quote.setUpdatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);
        saveLog(saved, "CONFIRMED", null, login);

        return buildResponse(saved);
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

        Quote quote = getQuoteOrThrow(id);

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

        return buildResponse(selected);
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

    @Transactional
    public QuoteResponse update(Long id, QuoteUpdateRequest request, String login) {

        Quote quote = getQuoteOrThrow(id);

        if (quote.getStatus() != QuoteStatus.DRAFT) {
            throw new BusinessException(ErrorCode.QUOTE_NOT_EDITABLE, "Só orçamentos em rascunho podem ser editados.");
        }

        List<QuoteItem> newItems = new ArrayList<>();

        long subtotal = 0;

        for (QuoteItemRequest r : request.getItems()) {

            if (r.getChargeType() == ChargeType.AREA && (r.getWidthCm() == null || r.getHeightCm() == null)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Largura e altura são obrigatórias para cobrança por área.");
            }

            QuoteItem item = new QuoteItem();

            item.setDescription(r.getDescription());
            item.setChargeType(r.getChargeType());
            item.setQuantity(r.getQuantity());
            item.setUnitPriceCents(r.getUnitPriceCents());
            if (r.getChargeType() == ChargeType.AREA) {
                item.setWidthCm(r.getWidthCm());
                item.setHeightCm(r.getHeightCm());
                item.setUnit(null);
            } else {
                item.setUnit(r.getUnit());
                item.setWidthCm(null);
                item.setHeightCm(null);
            }

            long itemSubtotal = MoneyCalculator.itemSubtotal(r.getChargeType(), r.getQuantity(), r.getWidthCm(), r.getHeightCm(), r.getUnitPriceCents());
            item.setSubtotalCents(itemSubtotal);
            subtotal += itemSubtotal;

            newItems.add(item);
        }

        long discountCents = 0;
        long discountValue = 0;

        if (request.getDiscountType() != null) {
            discountValue = request.getDiscountValue() == null ? 0 : request.getDiscountValue();
            discountCents = MoneyCalculator.discount(subtotal, request.getDiscountType(), discountValue);
        }

        long total = MoneyCalculator.total(subtotal, discountCents);

        quote.getItems().clear();

        for (QuoteItem i : newItems) {
            quote.addItem(i);
        }

        quote.setSubtotalCents(subtotal);
        quote.setDiscountType(request.getDiscountType());
        quote.setDiscountValue(discountValue);
        quote.setDiscountCents(discountCents);
        quote.setTotalCents(total);
        quote.setPaymentTerms(request.getPaymentTerms());
        quote.setNotes(request.getNotes());
        quote.setUpdatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);
        saveLog(saved, "UPDATED", null, login);
        return buildResponse(saved);
    }

    @Transactional
    public QuoteResponse backToDraft(Long id, String login) {
        Quote quote = getQuoteOrThrow(id);
        requireStatus(quote, QuoteStatus.CONFIRMED);

        quote.setStatus(QuoteStatus.DRAFT);
        quote.setConfirmedAt(null);
        quote.setUpdatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);

        saveLog(saved, "BACK_TO_DRAFT", null, login);

        return buildResponse(saved);
    }

    @Transactional
    public QuoteResponse dispatch(Long id, QuoteDispatchRequest request, String login) {
        Quote quote = getQuoteOrThrow(id);

        requireStatus(quote, QuoteStatus.CONFIRMED, QuoteStatus.SENT);

        if (quote.getStatus() == QuoteStatus.CONFIRMED) {
            quote.setStatus(QuoteStatus.SENT);
            quote.setSentAt(Instant.now());
        }

        quote.setUpdatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);

        saveLog(saved, "DISPATCHED", request.getChannel().name(), login);

        return buildResponse(saved);
    }

    @Transactional
    public QuoteResponse approve(Long id, QuoteApproveRequest request, String login) {
        Quote quote = getQuoteOrThrow(id);

        requireStatus(quote, QuoteStatus.SENT);

        quote.setStatus(QuoteStatus.APPROVED);
        quote.setApprovalMethod(request.getMethod());
        quote.setDecidedAt(Instant.now());
        quote.setUpdatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);

        saveLog(saved, "APPROVED", request.getMethod().name(), login);
        return buildResponse(saved);
    }

    @Transactional
    public QuoteResponse reject(Long id, QuoteRejectRequest request, String login) {
        Quote quote = getQuoteOrThrow(id);

        requireStatus(quote, QuoteStatus.SENT);

        quote.setStatus(QuoteStatus.REJECTED);
        quote.setRejectionReason(request.getReason());
        quote.setDecisionNote(request.getNote());
        quote.setDecidedAt(Instant.now());
        quote.setUpdatedAt(Instant.now());

        Quote saved = quoteRepository.save(quote);

        saveLog(saved, "REJECTED", request.getReason().name(), login);

        return buildResponse(saved);
    }
}