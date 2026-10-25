package com.zbox.backend.dto;

import com.zbox.backend.enums.CustomerAction;

import java.time.Instant;
import java.util.List;

public class CustomerHistoryResponse {

    private final Long id;
    private final CustomerAction action;
    private final List<String> changedFields;
    private final String userName;
    private final Instant createdAt;

    public CustomerHistoryResponse(Long id, CustomerAction action, List<String> changedFields, String userName, Instant createdAt) {
        this.id = id;
        this.action = action;
        this.changedFields = changedFields;
        this.userName = userName;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public CustomerAction getAction() {
        return action;
    }

    public List<String> getChangedFields() {
        return changedFields;
    }

    public String getUserName() {
        return userName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
