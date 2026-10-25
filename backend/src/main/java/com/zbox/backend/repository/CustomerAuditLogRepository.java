package com.zbox.backend.repository;

import com.zbox.backend.model.CustomerAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerAuditLogRepository extends JpaRepository<CustomerAuditLog,Long> {
    List<CustomerAuditLog> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
}
