package com.speedrweb.service;

import com.speedrweb.dto.VideoUploadResponse;
import com.speedrweb.model.User;
import com.speedrweb.model.Video;
import com.speedrweb.repository.UserRepository;
import com.speedrweb.repository.VideoRepository;
import com.speedrweb.security.SecurityUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

@Service
public class VideoService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"
    );

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final Path storageDir;

    public VideoService(VideoRepository videoRepository,
                        UserRepository userRepository,
                        @Value("${speedrweb.storage.video-dir}") String videoDir) {
        this.videoRepository = videoRepository;
        this.userRepository = userRepository;
        this.storageDir = Paths.get(videoDir).toAbsolutePath().normalize();
    }

    public VideoUploadResponse upload(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Unsupported file type: " + contentType + ". Allowed: " + ALLOWED_CONTENT_TYPES);
        }

        UUID userId = SecurityUtil.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Files.createDirectories(storageDir);

        String storedFilename = UUID.randomUUID() + getExtension(file.getOriginalFilename());
        Path targetPath = storageDir.resolve(storedFilename);
        file.transferTo(targetPath);

        Video video = new Video();
        video.setOriginalFilename(file.getOriginalFilename());
        video.setStoredFilename(storedFilename);
        video.setContentType(contentType);
        video.setFileSizeBytes(file.getSize());
        video.setStoragePath(targetPath.toString());
        video.setUser(user);

        video = videoRepository.save(video);

        return new VideoUploadResponse(video.getId(), video.getOriginalFilename(), video.getFileSizeBytes());
    }

    public Video getById(UUID videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("Video not found: " + videoId));

        UUID currentUserId = SecurityUtil.getCurrentUserId();
        if (!video.getUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Access denied");
        }

        return video;
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
