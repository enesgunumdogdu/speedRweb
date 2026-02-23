package com.speedrweb.dto;

import com.speedrweb.model.AnalysisStatus;
import com.speedrweb.model.SportType;

import java.time.Instant;
import java.util.UUID;

public record AnalysisResponse(
        UUID analysisId,
        UUID videoId,
        SportType sportType,
        AnalysisStatus status,
        Double speedKmh,
        Double speedMph,
        Double confidence,
        String errorMessage,
        Instant createdAt,
        Instant completedAt
) {
}
