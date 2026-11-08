package com.zbox.backend.dto;

import java.time.Instant;

public class QuoteEventResponse {
    private final Long id;
    private final String type;
    private final Integer version;
    private final String detail;
    private final String userName;
    private final Instant createdAt;

    public QuoteEventResponse(Long id, String type, Integer version, String detail, String userName, Instant createdAt) {
        this.id = id;
        this.type = type;
        this.version = version;
        this.detail = detail;
        this.userName = userName;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public Integer getVersion() {
        return version;
    }

    public String getDetail() {
        return detail;
    }

    public String getUserName() {
        return userName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
