package com.speedrweb.service.analyzer;

import com.speedrweb.model.SportType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class SportAnalyzerFactory {

    private final Map<SportType, SportAnalyzer> analyzerMap;

    public SportAnalyzerFactory(List<SportAnalyzer> analyzers) {
        this.analyzerMap = analyzers.stream()
                .collect(Collectors.toMap(SportAnalyzer::getSportType, Function.identity()));
    }

    public SportAnalyzer getAnalyzer(SportType sportType) {
        SportAnalyzer analyzer = analyzerMap.get(sportType);
        if (analyzer == null) {
            throw new IllegalArgumentException("No analyzer found for sport type: " + sportType);
        }
        return analyzer;
    }
}
