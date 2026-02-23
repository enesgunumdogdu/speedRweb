package com.speedrweb.dto;

import java.util.List;

public record AnalysisCallbackPayload(
        boolean success,
        Double speedKmh,
        Double speedMph,
        Double confidence,
        String errorMessage,
        FrameData frameData
) {
    public record FrameData(double fps, List<Double> frameSpeeds, Object poseLandmarks) {
    }
}
