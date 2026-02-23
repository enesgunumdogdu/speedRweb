package com.speedrweb.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.speedrweb.dto.AnalysisCallbackPayload;
import com.speedrweb.dto.AnalysisCreateRequest;
import com.speedrweb.dto.AnalysisListItem;
import com.speedrweb.dto.AnalysisResponse;
import com.speedrweb.dto.AnalysisResponse.FrameDataResponse;
import com.speedrweb.dto.PagedResponse;
import com.speedrweb.model.AnalysisRequest;
import com.speedrweb.model.AnalysisStatus;
import com.speedrweb.model.SportType;
import com.speedrweb.model.Video;
import com.speedrweb.repository.AnalysisRequestRepository;
import com.speedrweb.service.analyzer.SportAnalyzerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AnalysisService {

    private static final Logger log = LoggerFactory.getLogger(AnalysisService.class);

    private final AnalysisRequestRepository analysisRequestRepository;
    private final VideoService videoService;
    private final SportAnalyzerFactory sportAnalyzerFactory;
    private final ObjectMapper objectMapper;

    public AnalysisService(AnalysisRequestRepository analysisRequestRepository,
                           VideoService videoService,
                           SportAnalyzerFactory sportAnalyzerFactory,
                           ObjectMapper objectMapper) {
        this.analysisRequestRepository = analysisRequestRepository;
        this.videoService = videoService;
        this.sportAnalyzerFactory = sportAnalyzerFactory;
        this.objectMapper = objectMapper;
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
            analysis.setProgressPercent(100);
            analysis.setSpeedKmh(payload.speedKmh());
            analysis.setSpeedMph(payload.speedMph());
            analysis.setConfidence(payload.confidence());

            if (payload.frameData() != null) {
                try {
                    analysis.setFrameDataJson(objectMapper.writeValueAsString(payload.frameData()));
                } catch (JsonProcessingException e) {
                    log.warn("Failed to serialize frameData for analysis {}", analysisId, e);
                }
            }
        } else {
            analysis.setStatus(AnalysisStatus.FAILED);
            analysis.setErrorMessage(payload.errorMessage());
        }

        analysis.setCompletedAt(Instant.now());
        analysis = analysisRequestRepository.save(analysis);

        return toResponse(analysis);
    }

    public void updateProgress(UUID analysisId, int progressPercent) {
        AnalysisRequest analysis = analysisRequestRepository.findById(analysisId)
                .orElseThrow(() -> new IllegalArgumentException("Analysis not found: " + analysisId));

        int clamped = Math.max(0, Math.min(100, progressPercent));
        analysis.setProgressPercent(clamped);

        if (analysis.getStatus() == AnalysisStatus.PENDING) {
            analysis.setStatus(AnalysisStatus.PROCESSING);
            analysis.setStartedAt(Instant.now());
        }

        analysisRequestRepository.save(analysis);
    }

    public PagedResponse<AnalysisListItem> getAnalysisHistory(int page, int size) {
        Page<AnalysisRequest> resultPage = analysisRequestRepository
                .findAllWithVideo(PageRequest.of(page, size));

        List<AnalysisListItem> items = resultPage.getContent().stream()
                .map(a -> new AnalysisListItem(
                        a.getId(),
                        a.getVideo().getId(),
                        a.getVideo().getOriginalFilename(),
                        a.getSportType(),
                        a.getStatus(),
                        a.getSpeedKmh(),
                        a.getSpeedMph(),
                        a.getConfidence(),
                        a.getCreatedAt(),
                        a.getCompletedAt()
                ))
                .toList();

        return new PagedResponse<>(
                items,
                resultPage.getNumber(),
                resultPage.getSize(),
                resultPage.getTotalElements(),
                resultPage.getTotalPages()
        );
    }

    private AnalysisResponse toResponse(AnalysisRequest a) {
        FrameDataResponse frameData = null;
        if (a.getFrameDataJson() != null) {
            try {
                frameData = objectMapper.readValue(a.getFrameDataJson(), FrameDataResponse.class);
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize frameData for analysis {}", a.getId(), e);
            }
        }

        return new AnalysisResponse(
                a.getId(),
                a.getVideo().getId(),
                a.getSportType(),
                a.getStatus(),
                a.getProgressPercent(),
                a.getSpeedKmh(),
                a.getSpeedMph(),
                a.getConfidence(),
                a.getErrorMessage(),
                a.getCreatedAt(),
                a.getCompletedAt(),
                frameData
        );
    }
}
