package com.speedrweb.service;

import com.speedrweb.dto.AnalysisCallbackPayload;
import com.speedrweb.dto.AnalysisCreateRequest;
import com.speedrweb.dto.AnalysisResponse;
import com.speedrweb.model.AnalysisRequest;
import com.speedrweb.model.AnalysisStatus;
import com.speedrweb.model.SportType;
import com.speedrweb.model.Video;
import com.speedrweb.repository.AnalysisRequestRepository;
import com.speedrweb.service.analyzer.SportAnalyzerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class AnalysisService {

    private final AnalysisRequestRepository analysisRequestRepository;
    private final VideoService videoService;
    private final SportAnalyzerFactory sportAnalyzerFactory;

    public AnalysisService(AnalysisRequestRepository analysisRequestRepository,
                           VideoService videoService,
                           SportAnalyzerFactory sportAnalyzerFactory) {
        this.analysisRequestRepository = analysisRequestRepository;
        this.videoService = videoService;
        this.sportAnalyzerFactory = sportAnalyzerFactory;
    }

    public AnalysisResponse createAnalysis(AnalysisCreateRequest request) {
        Video video = videoService.getById(request.videoId());

        AnalysisRequest analysis = new AnalysisRequest();
        analysis.setVideo(video);
        analysis.setSportType(SportType.ICE_HOCKEY);
        analysis.setStatus(AnalysisStatus.PENDING);
        analysis.setReferenceLengthCm(request.referenceLengthCm());

        analysis = analysisRequestRepository.save(analysis);

        sportAnalyzerFactory.getAnalyzer(SportType.ICE_HOCKEY).analyze(analysis);

        return toResponse(analysis);
    }

    public AnalysisResponse getAnalysis(UUID analysisId) {
        AnalysisRequest analysis = analysisRequestRepository.findById(analysisId)
                .orElseThrow(() -> new IllegalArgumentException("Analysis not found: " + analysisId));
        return toResponse(analysis);
    }

    public AnalysisResponse handleCallback(UUID analysisId, AnalysisCallbackPayload payload) {
        AnalysisRequest analysis = analysisRequestRepository.findById(analysisId)
                .orElseThrow(() -> new IllegalArgumentException("Analysis not found: " + analysisId));

        if (payload.success()) {
            analysis.setStatus(AnalysisStatus.COMPLETED);
            analysis.setSpeedKmh(payload.speedKmh());
            analysis.setSpeedMph(payload.speedMph());
            analysis.setConfidence(payload.confidence());
        } else {
            analysis.setStatus(AnalysisStatus.FAILED);
            analysis.setErrorMessage(payload.errorMessage());
        }

        analysis.setCompletedAt(Instant.now());
        analysis = analysisRequestRepository.save(analysis);

        return toResponse(analysis);
    }

    private AnalysisResponse toResponse(AnalysisRequest a) {
        return new AnalysisResponse(
                a.getId(),
                a.getVideo().getId(),
                a.getSportType(),
                a.getStatus(),
                a.getSpeedKmh(),
                a.getSpeedMph(),
                a.getConfidence(),
                a.getErrorMessage(),
                a.getCreatedAt(),
                a.getCompletedAt()
        );
    }
}
