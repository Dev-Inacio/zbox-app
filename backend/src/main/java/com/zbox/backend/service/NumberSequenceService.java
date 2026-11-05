package com.zbox.backend.service;

import com.zbox.backend.model.NumberSequence;
import com.zbox.backend.repository.NumberSequenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class NumberSequenceService {

    private final NumberSequenceRepository numberSequenceRepository;

    public NumberSequenceService(NumberSequenceRepository numberSequenceRepository) {
        this.numberSequenceRepository = numberSequenceRepository;
    }

    @Transactional
    public String next(String name) {

        Optional<NumberSequence> found = numberSequenceRepository.findByName(name);

        NumberSequence sequence;

        if (found.isEmpty()) {
            sequence = new NumberSequence();
            sequence.setName(name);
            sequence.setLastNumber(0);
        } else {
            sequence = found.get();
        }

        long next = sequence.getLastNumber() + 1;

        sequence.setLastNumber(next);

        numberSequenceRepository.save(sequence);

        return String.format("%06d", next);
    }
}
