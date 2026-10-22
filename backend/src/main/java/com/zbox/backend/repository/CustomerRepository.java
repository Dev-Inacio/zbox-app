package com.zbox.backend.repository;

import com.zbox.backend.enums.CustomerStatus;
import com.zbox.backend.enums.CustomerType;
import com.zbox.backend.model.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    @Query("SELECT c FROM Customer c WHERE(:search IS NULL OR" +
            " c.name LIKE CONCAT('%', :search, '%') OR" +
            " c.phone LIKE CONCAT('%', :search, '%') OR" +
            " c.whatsapp LIKE CONCAT('%', :search, '%') OR" +
            " c.address.city LIKE CONCAT('%', :search, '%'))" +
            " AND (:status IS NULL OR c.status = :status)" +
            " AND (:type IS NULL OR c.type = :type)")
    Page<Customer> search(@Param("search") String search,
                          @Param("status") CustomerStatus status,
                          @Param("type") CustomerType type,
                          Pageable pageable);

    @Query("SELECT c FROM Customer c WHERE (c.phone IN :numbers " +
            "OR c.whatsapp IN :numbers) AND (:excludeId IS NULL " +
            "OR c.id <> :excludeId) ORDER BY c.name, c.id")
    List<Customer> findDuplicates(@Param("numbers") List<String> numbers,
                                @Param("excludeId") Long excludeId);
}
