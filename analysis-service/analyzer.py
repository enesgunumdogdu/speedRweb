from __future__ import annotations

import cv2
import numpy as np

# ── Reference dimensions (cm) ──
STICK_LENGTH_CM = 155.0            # Standard adult hockey stick (midpoint of 147-163 range)
PLAYER_HEIGHT_CM = 183.0           # Average ice hockey player height with skates/helmet ~190
STICK_WIDTH_RATIO_FALLBACK = 0.35  # Fallback: stick ≈ 35% of frame width

# ── Detection thresholds ──
MAX_FRAME_HEIGHT = 720
STICK_ASPECT_RATIO_MIN = 4.0       # Min length:width for a stick-shaped contour
STICK_FRAME_RATIO_MIN = 0.05       # Stick must be >= 5% of frame width
STICK_FRAME_RATIO_MAX = 0.80       # Stick can't exceed 80% of frame width
PLAYER_FRAME_RATIO_MIN = 0.15      # Player must be >= 15% of frame height
PLAYER_FRAME_RATIO_MAX = 0.95      # Player can't fill entire frame


class IceHockeyAnalyzer:
    """Analyzes ice hockey videos to measure stick swing speed using optical flow."""

    def analyze(self, video_path: str, reference_length_cm: float | None = None):
        """
        Main entry point.
        Returns (speed_kmh, speed_mph, confidence, frame_speeds_kmh, fps).
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

        # ── Auto-calibration pipeline ──
        cm_per_pixel, cal_method = self._auto_calibrate(
            frames, flow_magnitudes, peak_idx, reference_length_cm
        )

        # ── Speed calculations ──
        speed_cm_per_sec = peak_magnitude * fps * cm_per_pixel
        speed_kmh = round(speed_cm_per_sec * 0.036, 1)
        speed_mph = round(speed_kmh * 0.621371, 1)

        frame_speeds_kmh = [
            round(mag * fps * cm_per_pixel * 0.036, 2)
            for mag in flow_magnitudes
        ]

        confidence = self._calculate_confidence(
            flow_magnitudes, peak_idx, cal_method,
            reference_length_cm is not None, fps, len(frames), frames[0].shape[0]
        )

        return speed_kmh, speed_mph, confidence, frame_speeds_kmh, fps

    # ═══════════════════════════════════════════════════════════════
    # Video loading & optical flow (unchanged)
    # ═══════════════════════════════════════════════════════════════

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

        window = 2
        start = max(0, peak_idx - window)
        end = min(len(flow_magnitudes), peak_idx + window + 1)
        smoothed_peak = float(np.mean(flow_magnitudes[start:end]))

        final_peak = max(peak_mag, smoothed_peak)
        return final_peak, peak_idx

    # ═══════════════════════════════════════════════════════════════
    # Auto-calibration pipeline
    # ═══════════════════════════════════════════════════════════════

    def _auto_calibrate(self, frames, flow_magnitudes, peak_idx, reference_length_cm):
        """
        Multi-method automatic calibration. Tries detection methods in priority order
        and cross-validates when multiple signals are available.

        Methods (in order):
          1. Stick detection from optical flow — multi-frame consensus (best)
          2. Stick detection from edge/contour analysis (good backup)
          3. Player height estimation from motion silhouette (rough but independent)
          4. Frame-proportional fallback (last resort)

        Returns (cm_per_pixel, method_name).
        """
        frame_h, frame_w = frames[0].shape[:2]
        stick_cm = reference_length_cm or STICK_LENGTH_CM

        # Collect all estimates for cross-validation
        estimates = []

        # ── Method 1: Multi-frame stick detection via optical flow ──
        stick_flow_px = self._detect_stick_flow(frames, flow_magnitudes, peak_idx)
        if stick_flow_px:
            cm_px = stick_cm / stick_flow_px
            estimates.append(("stick_flow", cm_px, 0.85))

        # ── Method 2: Stick detection via edge/frame-difference analysis ──
        stick_edge_px = self._detect_stick_edges(frames, peak_idx)
        if stick_edge_px:
            cm_px = stick_cm / stick_edge_px
            estimates.append(("stick_edge", cm_px, 0.65))

        # ── Method 3: Player height estimation ──
        player_px = self._detect_player_height(frames)
        if player_px:
            cm_px = PLAYER_HEIGHT_CM / player_px
            estimates.append(("player_height", cm_px, 0.40))

        if not estimates:
            # Absolute fallback
            fallback_px = frame_w * STICK_WIDTH_RATIO_FALLBACK
            return stick_cm / fallback_px, "fallback"

        # ── Cross-validation & fusion ──
        return self._fuse_estimates(estimates)

    def _fuse_estimates(self, estimates):
        """
        Fuse multiple calibration estimates. If the top two methods agree
        (within 30%), boost confidence and use weighted average.
        Otherwise use the highest-confidence single estimate.
        """
        estimates.sort(key=lambda e: e[2], reverse=True)  # sort by confidence
        primary = estimates[0]

        if len(estimates) >= 2:
            # Check agreement between estimates
            cm_values = [e[1] for e in estimates]
            median_cm = float(np.median(cm_values))

            # Find estimates that agree with the median (within 30%)
            agreeing = [e for e in estimates if 0.7 < e[1] / median_cm < 1.3]

            if len(agreeing) >= 2:
                # Weighted average of agreeing estimates
                total_w = sum(e[2] for e in agreeing)
                fused_cm = sum(e[1] * e[2] for e in agreeing) / total_w
                return fused_cm, primary[0]

        return primary[1], primary[0]

    # ═══════════════════════════════════════════════════════════════
    # Method 1: Stick detection from optical flow (multi-frame)
    # ═══════════════════════════════════════════════════════════════

    def _detect_stick_flow(self, frames, flow_magnitudes, peak_idx):
        """
        Detect stick length from optical flow across multiple frames around
        the peak motion. Uses median of per-frame estimates for robustness
        against single-frame noise.
        """
        frame_h, frame_w = frames[0].shape[:2]
        peak_mag = flow_magnitudes[peak_idx]
        candidates = []

        # Analyze frames around peak where motion is significant (>40% of peak)
        window = 3
        for offset in range(-window, window + 1):
            idx = peak_idx + offset
            if idx < 0 or idx >= len(frames) - 1:
                continue
            if flow_magnitudes[idx] < peak_mag * 0.4:
                continue

            flow = cv2.calcOpticalFlowFarneback(
                frames[idx], frames[idx + 1],
                None, 0.5, 3, 15, 3, 5, 1.2, 0
            )
            stick_px = self._extract_stick_from_flow(flow, frame_h, frame_w)
            if stick_px:
                candidates.append(stick_px)

        if not candidates:
            return None

        # Median for outlier rejection
        median_px = float(np.median(candidates))

        # Remove outliers beyond 25% of median, recompute
        inliers = [c for c in candidates if 0.75 < c / median_px < 1.25]
        if inliers:
            return float(np.median(inliers))

        return median_px

    def _extract_stick_from_flow(self, flow, frame_h, frame_w):
        """Extract the most stick-like elongated object from a single optical flow field."""
        mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])

        # Adaptive threshold at 95th percentile of motion
        threshold = np.percentile(mag, 95)
        mask = (mag > threshold).astype(np.uint8) * 255

        # Morphological cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._best_stick_contour(contours, frame_h, frame_w)

    # ═══════════════════════════════════════════════════════════════
    # Method 2: Stick detection from edge/frame-difference analysis
    # ═══════════════════════════════════════════════════════════════

    def _detect_stick_edges(self, frames, peak_idx):
        """
        Detect stick from frame differencing and edge analysis.
        The frame difference highlights moving objects; morphological filtering
        isolates elongated stick-like shapes.
        """
        idx = min(peak_idx, len(frames) - 2)
        frame_h, frame_w = frames[0].shape[:2]

        # Frame difference to isolate moving objects
        diff = cv2.absdiff(frames[idx], frames[idx + 1])
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

        # Directional dilation to connect stick fragments
        # (stick can be at any angle, so use both horizontal and vertical kernels)
        kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3))
        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 9))
        dilated = cv2.dilate(thresh, kernel_h, iterations=2)
        dilated = cv2.dilate(dilated, kernel_v, iterations=1)

        # Cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        cleaned = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._best_stick_contour(contours, frame_h, frame_w)

    # ═══════════════════════════════════════════════════════════════
    # Method 3: Player height from motion silhouette
    # ═══════════════════════════════════════════════════════════════

    def _detect_player_height(self, frames):
        """
        Estimate player height by accumulating frame-to-frame motion across
        the entire video. The accumulated motion forms a player silhouette
        whose bounding box height approximates player height.
        """
        frame_h, frame_w = frames[0].shape[:2]

        # Accumulate motion (sample up to ~60 frame pairs for speed)
        motion_acc = np.zeros((frame_h, frame_w), dtype=np.float32)
        sample_step = max(1, (len(frames) - 1) // 60)

        for i in range(0, len(frames) - 1, sample_step):
            diff = cv2.absdiff(frames[i], frames[i + 1])
            motion_acc += diff.astype(np.float32)

        max_val = motion_acc.max()
        if max_val == 0:
            return None

        motion_norm = (motion_acc / max_val * 255).astype(np.uint8)

        # Threshold to get player region
        _, mask = cv2.threshold(motion_norm, 40, 255, cv2.THRESH_BINARY)

        # Large morphological operations to merge body parts into single blob
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        # Find the tallest significant contour (likely the player)
        best_height = None
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < frame_h * frame_w * 0.005:
                continue  # too small to be a player

            _, _, w, h = cv2.boundingRect(contour)
            height_ratio = h / frame_h
            width_ratio = w / frame_w

            if height_ratio < PLAYER_FRAME_RATIO_MIN:
                continue
            if height_ratio > PLAYER_FRAME_RATIO_MAX:
                continue
            # Player should be taller than wide (aspect ratio check)
            if h < w * 1.2:
                continue

            # Exclude very wide blobs (multiple players or entire rink motion)
            if width_ratio > 0.6:
                continue

            if best_height is None or h > best_height:
                best_height = h

        return float(best_height) if best_height else None

    # ═══════════════════════════════════════════════════════════════
    # Shared: stick contour scoring
    # ═══════════════════════════════════════════════════════════════

    def _best_stick_contour(self, contours, frame_h, frame_w):
        """
        From a list of contours, find the one most likely to be a hockey stick.
        Filters by aspect ratio, size, and scores by elongation.
        Returns stick length in pixels or None.
        """
        if not contours:
            return None

        min_area = frame_h * frame_w * 0.0005
        best_length = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area:
                continue

            rect = cv2.minAreaRect(contour)
            w, h = rect[1]
            length = max(w, h)
            width = min(w, h) if min(w, h) > 0 else 1

            aspect_ratio = length / width
            if aspect_ratio < STICK_ASPECT_RATIO_MIN:
                continue  # not elongated enough to be a stick

            frame_ratio = length / frame_w
            if frame_ratio < STICK_FRAME_RATIO_MIN or frame_ratio > STICK_FRAME_RATIO_MAX:
                continue  # too small or impossibly large

            # Score: prefer highly elongated + larger area objects
            score = aspect_ratio * np.sqrt(area)
            if score > best_score:
                best_score = score
                best_length = float(length)

        return best_length

    # ═══════════════════════════════════════════════════════════════
    # Confidence scoring
    # ═══════════════════════════════════════════════════════════════

    def _calculate_confidence(
        self, flow_magnitudes, peak_idx,
        cal_method, reference_provided,
        fps, frame_count, frame_height
    ):
        """
        Confidence score 0.0-1.0 based on:
        - Peak distinctness (0.4 weight)
        - Calibration quality (0.4 weight)
        - Video quality (0.2 weight)
        """
        # ── Peak distinctness ──
        mean_mag = float(np.mean(flow_magnitudes))
        peak_mag = flow_magnitudes[peak_idx]
        if mean_mag > 0:
            peak_ratio = peak_mag / mean_mag
            peak_score = min(1.0, (peak_ratio - 1.0) / 4.0)
        else:
            peak_score = 0.0
        peak_score = max(0.0, peak_score)

        # ── Calibration quality (based on detection method) ──
        method_scores = {
            "stick_flow": 0.90,       # Multi-frame optical flow (best)
            "stick_edge": 0.70,       # Edge-based detection (good)
            "player_height": 0.50,    # Player silhouette (rough)
            "fallback": 0.20,         # Frame-based guess (poor)
        }
        cal_score = method_scores.get(cal_method, 0.20)
        if reference_provided:
            cal_score = min(1.0, cal_score + 0.10)

        # ── Video quality ──
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
