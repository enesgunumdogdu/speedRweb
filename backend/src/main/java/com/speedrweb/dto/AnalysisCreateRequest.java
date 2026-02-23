package com.speedrweb.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AnalysisCreateRequest(
        @NotNull UUID videoId,
        Double referenceLengthCm
) {
}
