package com.speedrweb.controller;

import com.speedrweb.dto.AnalysisCallbackPayload;
import com.speedrweb.dto.AnalysisCreateRequest;
import com.speedrweb.dto.AnalysisResponse;
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

    @PostMapping("/{analysisId}/callback")
    public ResponseEntity<Void> callback(@PathVariable UUID analysisId,
                                          @RequestBody AnalysisCallbackPayload payload) {
        analysisService.handleCallback(analysisId, payload);
        return ResponseEntity.ok().build();
    }
}
