package com.zbox.backend.repository;

import com.zbox.backend.enums.QuoteStatus;
import com.zbox.backend.model.Quote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface QuoteRepository extends JpaRepository<Quote, Long> {

    List<Quote> findByNumberOrderByVersionAsc(String number);

    @Query("SELECT q FROM Quote q WHERE q.status <> :superseded" +
            " AND (:search IS NULL OR q.number LIKE CONCAT('%', :search, '%')" +
            " OR q.customer.name LIKE CONCAT('%', :search, '%'))" +
            " AND (:status IS NULL OR q.status = :status)" +
            " AND (:customerId IS NULL OR q.customer.id = :customerId)" +
            " AND q.createdAt >= :since")
    Page<Quote> search(@Param("search") String search,
                       @Param("status") QuoteStatus status,
                       @Param("customerId") Long customerId,
                       @Param("since") Instant since,
                       @Param("superseded") QuoteStatus superseded,
                       Pageable pageable);


    @Query("SELECT q.status, COUNT(q) FROM Quote q WHERE q.status <> :superseded GROUP BY q.status")
    List<Object[]> countByStatus(@Param("superseded") QuoteStatus superseded);
}
