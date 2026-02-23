package com.speedrweb.controller;

import com.speedrweb.dto.ChangePasswordRequest;
import com.speedrweb.dto.UpdateProfileRequest;
import com.speedrweb.dto.UserProfileResponse;
import com.speedrweb.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile() {
        return ResponseEntity.ok(authService.getProfile());
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(request));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ResponseEntity.ok().build();
    }
}
