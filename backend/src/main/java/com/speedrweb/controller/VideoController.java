package com.speedrweb.controller;

import com.speedrweb.dto.VideoUploadResponse;
import com.speedrweb.service.VideoService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/videos")
public class VideoController {

    private final VideoService videoService;

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<VideoUploadResponse> upload(@RequestParam("file") MultipartFile file) throws IOException {
        VideoUploadResponse response = videoService.upload(file);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{videoId}")
    public ResponseEntity<VideoUploadResponse> getVideo(@PathVariable UUID videoId) {
        var video = videoService.getById(videoId);
        return ResponseEntity.ok(new VideoUploadResponse(
                video.getId(), video.getOriginalFilename(), video.getFileSizeBytes()
        ));
    }
}
