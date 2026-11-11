package com.zbox.backend.service;

import com.zbox.backend.dto.QuoteCreateRequest;
import com.zbox.backend.dto.QuoteResponse;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

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
}
