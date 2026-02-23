package com.speedrweb.service.analyzer;

import com.speedrweb.model.AnalysisRequest;
import com.speedrweb.model.AnalysisStatus;
import com.speedrweb.model.SportType;
import com.speedrweb.repository.AnalysisRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;

@Component
public class IceHockeyAnalyzer implements SportAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(IceHockeyAnalyzer.class);

    private final RestTemplate restTemplate;
    private final AnalysisRequestRepository analysisRequestRepository;
    private final String pythonServiceUrl;

    public IceHockeyAnalyzer(RestTemplate restTemplate,
                             AnalysisRequestRepository analysisRequestRepository,
                             @Value("${speedrweb.analysis.python-service-url}") String pythonServiceUrl) {
        this.restTemplate = restTemplate;
        this.analysisRequestRepository = analysisRequestRepository;
        this.pythonServiceUrl = pythonServiceUrl;
    }

    @Override
    public SportType getSportType() {
        return SportType.ICE_HOCKEY;
    }

    @Async
    @Override
    public void analyze(AnalysisRequest request) {
        request.setStatus(AnalysisStatus.PROCESSING);
        request.setStartedAt(Instant.now());
        analysisRequestRepository.save(request);

        try {
            String baseUrl = "http://localhost:8080/api/analysis/" + request.getId();
            String callbackUrl = baseUrl + "/callback";
            String progressUrl = baseUrl + "/progress";

            Map<String, Object> payload = Map.of(
                    "analysis_id", request.getId().toString(),
                    "video_path", request.getVideo().getStoragePath(),
                    "reference_length_cm", request.getReferenceLengthCm() != null ? request.getReferenceLengthCm() : 0,
                    "callback_url", callbackUrl,
                    "progress_url", progressUrl
            );

            restTemplate.postForEntity(
                    pythonServiceUrl + "/analyze/ice-hockey",
                    payload,
                    Void.class
            );

            log.info("Analysis request sent to Python service: {}", request.getId());
        } catch (Exception e) {
            log.error("Failed to send analysis request to Python service: {}", request.getId(), e);
            request.setStatus(AnalysisStatus.FAILED);
            request.setErrorMessage("Failed to reach analysis service: " + e.getMessage());
            request.setCompletedAt(Instant.now());
            analysisRequestRepository.save(request);
        }
    }
}
