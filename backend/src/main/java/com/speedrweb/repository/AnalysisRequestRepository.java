package com.speedrweb.repository;

import com.speedrweb.model.AnalysisRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AnalysisRequestRepository extends JpaRepository<AnalysisRequest, UUID> {
}
