package com.speedrweb.controller;

import com.speedrweb.dto.VideoUploadResponse;
import com.speedrweb.model.Video;
import com.speedrweb.service.VideoService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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

    @GetMapping("/{videoId}/stream")
    public ResponseEntity<Resource> streamVideo(
            @PathVariable UUID videoId,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader
    ) throws IOException {
        Video video = videoService.getById(videoId);
        Path filePath = Path.of(video.getStoragePath());

        if (!Files.exists(filePath)) {
            return ResponseEntity.notFound().build();
        }

        long fileSize = Files.size(filePath);
        Resource resource = new FileSystemResource(filePath);
        String contentType = video.getContentType();

        if (rangeHeader == null) {
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(fileSize))
                    .body(resource);
        }

        // Parse "bytes=start-end"
        String range = rangeHeader.replace("bytes=", "");
        String[] parts = range.split("-");
        long start = Long.parseLong(parts[0]);
        long end = parts.length > 1 && !parts[1].isEmpty()
                ? Long.parseLong(parts[1])
                : Math.min(start + 1024 * 1024 - 1, fileSize - 1);

        if (end >= fileSize) {
            end = fileSize - 1;
        }

        long contentLength = end - start + 1;

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fileSize)
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(contentLength))
                .body(new RangeResource(resource, start, contentLength));
    }

    private static class RangeResource extends FileSystemResource {
        private final Resource delegate;
        private final long start;
        private final long length;

        RangeResource(Resource delegate, long start, long length) {
            super(((FileSystemResource) delegate).getPath());
            this.delegate = delegate;
            this.start = start;
            this.length = length;
        }

        @Override
        public java.io.InputStream getInputStream() throws IOException {
            java.io.InputStream is = delegate.getInputStream();
            is.skip(start);
            return new java.io.FilterInputStream(is) {
                private long remaining = length;

                @Override
                public int read() throws IOException {
                    if (remaining <= 0) return -1;
                    int b = super.read();
                    if (b != -1) remaining--;
                    return b;
                }

                @Override
                public int read(byte[] b, int off, int len) throws IOException {
                    if (remaining <= 0) return -1;
                    int toRead = (int) Math.min(len, remaining);
                    int n = super.read(b, off, toRead);
                    if (n > 0) remaining -= n;
                    return n;
                }
            };
        }

        @Override
        public long contentLength() {
            return length;
        }
    }
}
