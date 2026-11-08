package com.zbox.backend.repository;

import com.zbox.backend.model.Quote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuoteRepository extends JpaRepository<Quote, Long> {

    List<Quote> findByNumberOrderByVersionAsc(String number);

}
