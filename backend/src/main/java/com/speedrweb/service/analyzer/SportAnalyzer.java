package com.speedrweb.service.analyzer;

import com.speedrweb.model.AnalysisRequest;
import com.speedrweb.model.SportType;

public interface SportAnalyzer {

    SportType getSportType();

    void analyze(AnalysisRequest request);
}
