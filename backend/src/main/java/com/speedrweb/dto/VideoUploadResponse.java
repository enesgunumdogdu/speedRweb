package com.speedrweb.dto;

import java.util.UUID;

public record VideoUploadResponse(
        UUID videoId,
        String originalFilename,
        Long fileSizeBytes
) {
}
