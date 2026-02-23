package com.speedrweb.service;

import com.speedrweb.dto.*;
import com.speedrweb.model.User;
import com.speedrweb.repository.AnalysisRequestRepository;
import com.speedrweb.repository.UserRepository;
import com.speedrweb.security.JwtUtil;
import com.speedrweb.security.SecurityUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final AnalysisRequestRepository analysisRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository userRepository,
                       AnalysisRequestRepository analysisRequestRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.analysisRequestRepository = analysisRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already in use");
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName());
        user = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new AuthResponse(token, user.getId(), user.getEmail(), user.getDisplayName());
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new AuthResponse(token, user.getId(), user.getEmail(), user.getDisplayName());
    }

    public UserProfileResponse getProfile() {
        UUID userId = SecurityUtil.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        long totalAnalyses = analysisRequestRepository.countByVideoUserId(userId);
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt(), totalAnalyses);
    }

    public UserProfileResponse updateProfile(UpdateProfileRequest request) {
        UUID userId = SecurityUtil.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setDisplayName(request.displayName());
        user = userRepository.save(user);
        long totalAnalyses = analysisRequestRepository.countByVideoUserId(userId);
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt(), totalAnalyses);
    }

    public void changePassword(ChangePasswordRequest request) {
        UUID userId = SecurityUtil.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }
}
