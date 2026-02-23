package com.speedrweb.dto;

import java.time.Instant;
import java.util.UUID;

public record UserProfileResponse(
        UUID userId,
        String email,
        String displayName,
        Instant createdAt,
        long totalAnalyses
) {
}
