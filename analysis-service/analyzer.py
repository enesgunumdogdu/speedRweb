from __future__ import annotations

import cv2
import numpy as np

DEFAULT_STICK_LENGTH_CM = 150.0
STICK_WIDTH_RATIO_FALLBACK = 0.35
MAX_FRAME_HEIGHT = 720


class IceHockeyAnalyzer:
    """Analyzes ice hockey videos to measure stick swing speed using optical flow."""

    def analyze(self, video_path: str, reference_length_cm: float | None = None):
        """
        Main entry point. Returns (speed_kmh, speed_mph, confidence).
        Raises ValueError for invalid/unusable videos.
        """
        frames, fps = self._load_video(video_path)

        if len(frames) < 5:
            raise ValueError(
                f"Video too short: only {len(frames)} frames. "
                "At least 5 frames are required for analysis."
            )

        flow_magnitudes = self._compute_optical_flows(frames)
        peak_magnitude, peak_idx = self._find_peak_speed(flow_magnitudes)

        peak_flow = cv2.calcOpticalFlowFarneback(
            frames[peak_idx], frames[peak_idx + 1],
            None, 0.5, 3, 15, 3, 5, 1.2, 0
        )

        frame_h, frame_w = frames[0].shape[:2]
        stick_length_px = self._estimate_stick_length(peak_flow, (frame_h, frame_w))

        ref_cm = reference_length_cm if reference_length_cm else DEFAULT_STICK_LENGTH_CM
        calibration_success = stick_length_px is not None

        cm_per_pixel = self._calibrate(stick_length_px, ref_cm, frame_w)

        peak_speed_px_per_sec = peak_magnitude * fps
        speed_cm_per_sec = peak_speed_px_per_sec * cm_per_pixel
        speed_kmh = round(speed_cm_per_sec * 0.036, 1)
        speed_mph = round(speed_kmh * 0.621371, 1)

        confidence = self._calculate_confidence(
            flow_magnitudes, peak_idx, calibration_success,
            reference_length_cm is not None, fps, len(frames), frame_h
        )

        return speed_kmh, speed_mph, confidence

    def _load_video(self, video_path: str):
        """Load video, convert to grayscale, resize if needed. Returns (frames, fps)."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0

        frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            h, w = gray.shape
            if h > MAX_FRAME_HEIGHT:
                scale = MAX_FRAME_HEIGHT / h
                gray = cv2.resize(
                    gray, (int(w * scale), MAX_FRAME_HEIGHT),
                    interpolation=cv2.INTER_AREA
                )

            frames.append(gray)

        cap.release()

        if len(frames) == 0:
            raise ValueError(f"No frames could be read from: {video_path}")

        return frames, fps

    def _compute_optical_flows(self, frames):
        """Compute per-frame-pair peak magnitude (99th percentile) using Farneback."""
        magnitudes = []
        for i in range(len(frames) - 1):
            flow = cv2.calcOpticalFlowFarneback(
                frames[i], frames[i + 1],
                None, 0.5, 3, 15, 3, 5, 1.2, 0
            )
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            peak_mag = float(np.percentile(mag, 99))
            magnitudes.append(peak_mag)
        return magnitudes

    def _find_peak_speed(self, flow_magnitudes):
        """Find the frame pair with highest motion. Returns (peak_magnitude, peak_index)."""
        peak_idx = int(np.argmax(flow_magnitudes))
        peak_mag = flow_magnitudes[peak_idx]

        # Average over a small window around peak for stability
        window = 2
        start = max(0, peak_idx - window)
        end = min(len(flow_magnitudes), peak_idx + window + 1)
        smoothed_peak = float(np.mean(flow_magnitudes[start:end]))

        # Use the higher of raw peak and smoothed (peak is at least smoothed)
        final_peak = max(peak_mag, smoothed_peak)

        return final_peak, peak_idx

    def _estimate_stick_length(self, flow, frame_shape):
        """
        Estimate the stick length in pixels from the peak optical flow frame.
        Returns stick_length_px or None if detection fails.
        """
        mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])

        threshold = np.percentile(mag, 95)
        mask = (mag > threshold).astype(np.uint8) * 255

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        min_area = frame_shape[0] * frame_shape[1] * 0.001
        if cv2.contourArea(largest) < min_area:
            return None

        rect = cv2.minAreaRect(largest)
        w, h = rect[1]
        stick_length_px = max(w, h)

        # Sanity check: stick should be at least 5% of frame width
        if stick_length_px < frame_shape[1] * 0.05:
            return None

        return float(stick_length_px)

    def _calibrate(self, stick_length_px, reference_length_cm, frame_width):
        """Convert pixel measurements to cm/pixel ratio."""
        if stick_length_px is not None and stick_length_px > 0:
            return reference_length_cm / stick_length_px
        # Fallback: assume stick spans ~35% of frame width
        estimated_px = frame_width * STICK_WIDTH_RATIO_FALLBACK
        return reference_length_cm / estimated_px

    def _calculate_confidence(
        self, flow_magnitudes, peak_idx,
        calibration_success, reference_provided,
        fps, frame_count, frame_height
    ):
        """
        Confidence score 0.0-1.0 based on:
        - Peak distinctness (0.4 weight)
        - Calibration quality (0.4 weight)
        - Video quality (0.2 weight)
        """
        # Peak distinctness
        mean_mag = float(np.mean(flow_magnitudes))
        peak_mag = flow_magnitudes[peak_idx]
        if mean_mag > 0:
            peak_ratio = peak_mag / mean_mag
            peak_score = min(1.0, (peak_ratio - 1.0) / 4.0)
        else:
            peak_score = 0.0
        peak_score = max(0.0, peak_score)

        # Calibration quality
        cal_score = 0.0
        if calibration_success and reference_provided:
            cal_score = 1.0
        elif calibration_success:
            cal_score = 0.6
        elif reference_provided:
            cal_score = 0.4
        else:
            cal_score = 0.2

        # Video quality
        vid_score = 0.0
        if frame_count >= 30:
            vid_score += 0.33
        elif frame_count >= 10:
            vid_score += 0.15
        if fps >= 30:
            vid_score += 0.34
        elif fps >= 15:
            vid_score += 0.17
        if frame_height >= 480:
            vid_score += 0.33
        elif frame_height >= 240:
            vid_score += 0.15
        vid_score = min(1.0, vid_score)

        confidence = (0.4 * peak_score) + (0.4 * cal_score) + (0.2 * vid_score)
        return round(min(1.0, max(0.0, confidence)), 2)
