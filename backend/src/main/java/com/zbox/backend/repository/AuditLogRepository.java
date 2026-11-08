package com.zbox.backend.repository;

import com.zbox.backend.enums.AuditEntity;
import com.zbox.backend.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByEntityTypeAndEntityIdInOrderByCreatedAtAsc(AuditEntity entityType, Collection<Long> entityIds);
}
