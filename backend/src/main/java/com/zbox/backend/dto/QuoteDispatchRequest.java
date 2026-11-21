package com.zbox.backend.dto;

import com.zbox.backend.enums.DispatchChannel;
import jakarta.validation.constraints.NotNull;

public class QuoteDispatchRequest {

    @NotNull(message = "O canal é obrigatório.")
    private DispatchChannel channel;

    public QuoteDispatchRequest() {
    }

    public DispatchChannel getChannel() {
        return channel;
    }

    public void setChannel(DispatchChannel channel) {
        this.channel = channel;
    }
}
