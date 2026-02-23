package com.speedrweb.dto;

public record AnalysisCallbackPayload(
        boolean success,
        Double speedKmh,
        Double speedMph,
        Double confidence,
        String errorMessage
) {
}
