package com.zbox.backend.repository;

import com.zbox.backend.model.NumberSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface NumberSequenceRepository extends JpaRepository<NumberSequence,String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<NumberSequence> findByName(String name);
}
