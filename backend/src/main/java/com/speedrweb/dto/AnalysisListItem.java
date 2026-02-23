package com.speedrweb.dto;

import com.speedrweb.model.AnalysisStatus;
import com.speedrweb.model.SportType;

import java.time.Instant;
import java.util.UUID;

public record AnalysisListItem(
        UUID analysisId,
        UUID videoId,
        String videoFilename,
        SportType sportType,
        AnalysisStatus status,
        Double speedKmh,
        Double speedMph,
        Double confidence,
        Instant createdAt,
        Instant completedAt
) {
}
