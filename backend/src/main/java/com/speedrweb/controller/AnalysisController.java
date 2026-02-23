package com.speedrweb.controller;

import com.speedrweb.dto.AnalysisCallbackPayload;
import com.speedrweb.dto.AnalysisCreateRequest;
import com.speedrweb.dto.AnalysisListItem;
import com.speedrweb.dto.AnalysisProgressPayload;
import com.speedrweb.dto.AnalysisResponse;
import com.speedrweb.dto.PagedResponse;
import com.speedrweb.service.AnalysisService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<AnalysisListItem>> getAnalysisHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<AnalysisListItem> response = analysisService.getAnalysisHistory(page, size);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<AnalysisResponse> createAnalysis(@Valid @RequestBody AnalysisCreateRequest request) {
        AnalysisResponse response = analysisService.createAnalysis(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{analysisId}")
    public ResponseEntity<AnalysisResponse> getAnalysis(@PathVariable UUID analysisId) {
        AnalysisResponse response = analysisService.getAnalysis(analysisId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{analysisId}/progress")
    public ResponseEntity<Void> updateProgress(@PathVariable UUID analysisId,
                                                @RequestBody AnalysisProgressPayload payload) {
        analysisService.updateProgress(analysisId, payload.progressPercent());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{analysisId}/callback")
    public ResponseEntity<Void> callback(@PathVariable UUID analysisId,
                                          @RequestBody AnalysisCallbackPayload payload) {
        analysisService.handleCallback(analysisId, payload);
        return ResponseEntity.ok().build();
    }
}
