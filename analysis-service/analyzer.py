from __future__ import annotations

import os
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
    RunningMode,
)
from skimage.filters import frangi

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "pose_landmarker.task")

# ── Reference dimensions (cm) ──
STICK_LENGTH_CM = 155.0            # Standard adult hockey stick (midpoint of 147-163 range)
PLAYER_HEIGHT_CM = 183.0           # Average ice hockey player height
ARM_LENGTH_CM = 65.0               # Average shoulder-to-wrist distance
SHOULDER_WIDTH_CM = 45.0           # Average shoulder width
STICK_WIDTH_RATIO_FALLBACK = 0.35  # Fallback: stick ≈ 35% of frame width

# ── Detection thresholds ──
MAX_FRAME_HEIGHT = 720
STICK_ASPECT_RATIO_MIN = 4.0
STICK_FRAME_RATIO_MIN = 0.05
STICK_FRAME_RATIO_MAX = 0.80
PLAYER_FRAME_RATIO_MIN = 0.15
PLAYER_FRAME_RATIO_MAX = 0.95

# ── MediaPipe landmark indices ──
LM_NOSE = 0
LM_LEFT_SHOULDER = 11
LM_RIGHT_SHOULDER = 12
LM_LEFT_ELBOW = 13
LM_RIGHT_ELBOW = 14
LM_LEFT_WRIST = 15
LM_RIGHT_WRIST = 16
LM_LEFT_HIP = 23
LM_RIGHT_HIP = 24
LM_LEFT_KNEE = 25
LM_RIGHT_KNEE = 26
LM_LEFT_ANKLE = 27
LM_RIGHT_ANKLE = 28

# ── Overlay landmark indices (all landmarks we want to send to frontend) ──
OVERLAY_LM_INDICES = [
    LM_NOSE,
    LM_LEFT_SHOULDER, LM_RIGHT_SHOULDER,
    LM_LEFT_ELBOW, LM_RIGHT_ELBOW,
    LM_LEFT_WRIST, LM_RIGHT_WRIST,
    LM_LEFT_HIP, LM_RIGHT_HIP,
    LM_LEFT_KNEE, LM_RIGHT_KNEE,
    LM_LEFT_ANKLE, LM_RIGHT_ANKLE,
]


class IceHockeyAnalyzer:
    """Analyzes ice hockey videos to measure stick swing speed
    using optical flow + MediaPipe pose estimation + ridge detection."""

    def __init__(self):
        self._landmarker = None  # lazy init

    def _get_landmarker(self):
        if self._landmarker is None:
            options = PoseLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=_MODEL_PATH),
                running_mode=RunningMode.IMAGE,
                num_poses=1,
                min_pose_detection_confidence=0.5,
                min_pose_presence_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self._landmarker = PoseLandmarker.create_from_options(options)
        return self._landmarker

    def analyze(self, video_path: str, reference_length_cm: float | None = None,
                on_progress: callable = None):
        """
        Main entry point.
        Returns (speed_kmh, speed_mph, confidence, frame_speeds_kmh, fps).
        """
        def report(pct: int):
            if on_progress:
                on_progress(pct)

        report(5)
        gray_frames, rgb_frames, fps = self._load_video(video_path)

        if len(gray_frames) < 5:
            raise ValueError(
                f"Video too short: only {len(gray_frames)} frames. "
                "At least 5 frames are required for analysis."
            )

        report(10)
        # ── Pose estimation on sampled frames ──
        pose_data, overlay_landmarks = self._run_pose_estimation(rgb_frames)

        report(15)
        flow_magnitudes = self._compute_optical_flows(gray_frames, on_progress)
        report(75)
        peak_magnitude, peak_idx = self._find_peak_speed(flow_magnitudes)

        # ── Wrist-based speed (direct measurement from pose) ──
        wrist_speed_px = self._compute_wrist_speed(pose_data, peak_idx, fps)

        # ── Auto-calibration pipeline ──
        report(80)
        cm_per_pixel, cal_method = self._auto_calibrate(
            gray_frames, rgb_frames, flow_magnitudes, peak_idx,
            reference_length_cm, pose_data
        )

        # ── Speed calculations ──
        report(90)

        # If we have wrist speed from pose, blend with optical flow
        if wrist_speed_px is not None:
            # Wrist tracks the handle; stick tip moves ~1.5-2x faster (lever effect)
            lever_ratio = 1.7
            pose_speed_cm = wrist_speed_px * lever_ratio * cm_per_pixel
            flow_speed_cm = peak_magnitude * fps * cm_per_pixel

            # Weighted blend: pose is more accurate for direction, flow for magnitude
            speed_cm_per_sec = flow_speed_cm * 0.6 + pose_speed_cm * 0.4
        else:
            speed_cm_per_sec = peak_magnitude * fps * cm_per_pixel

        speed_kmh = round(speed_cm_per_sec * 0.036, 1)
        speed_mph = round(speed_kmh * 0.621371, 1)

        frame_speeds_kmh = [
            round(mag * fps * cm_per_pixel * 0.036, 2)
            for mag in flow_magnitudes
        ]

        confidence = self._calculate_confidence(
            flow_magnitudes, peak_idx, cal_method,
            reference_length_cm is not None,
            fps, len(gray_frames), gray_frames[0].shape[0],
            pose_data, wrist_speed_px is not None
        )

        report(95)
        return speed_kmh, speed_mph, confidence, frame_speeds_kmh, fps, overlay_landmarks

    # ═══════════════════════════════════════════════════════════════
    # Video loading
    # ═══════════════════════════════════════════════════════════════

    def _load_video(self, video_path: str):
        """Load video, returns (gray_frames, rgb_frames, fps)."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0

        gray_frames = []
        rgb_frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            h, w = frame.shape[:2]
            if h > MAX_FRAME_HEIGHT:
                scale = MAX_FRAME_HEIGHT / h
                frame = cv2.resize(
                    frame, (int(w * scale), MAX_FRAME_HEIGHT),
                    interpolation=cv2.INTER_AREA
                )

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            gray_frames.append(gray)
            rgb_frames.append(rgb)

        cap.release()

        if len(gray_frames) == 0:
            raise ValueError(f"No frames could be read from: {video_path}")

        return gray_frames, rgb_frames, fps

    # ═══════════════════════════════════════════════════════════════
    # MediaPipe Pose Estimation
    # ═══════════════════════════════════════════════════════════════

    def _run_pose_estimation(self, rgb_frames):
        """
        Run MediaPipe Pose on sampled frames.
        Returns (raw_results, overlay_landmarks):
          - raw_results: list of per-frame landmark dicts (pixel coords, visibility>0.5)
            for internal calibration/wrist speed use. Forward-filled.
          - overlay_landmarks: dict with 'step' and 'frames' for frontend skeleton overlay.
            Normalized 0-1 coords, visibility>0.3, sampled every 3 frames.
        """
        landmarker = self._get_landmarker()
        frame_h, frame_w = rgb_frames[0].shape[:2]
        total = len(rgb_frames)

        # ── Internal analysis: sample ~50 frames, visibility > 0.5 ──
        internal_step = max(1, total // 50)
        raw_results = [None] * total

        # ── Overlay: every 3 frames, visibility > 0.3 ──
        overlay_step = 3
        overlay_frames = [None] * total

        # Combine both sampling grids to avoid duplicate detections
        frames_to_detect = set()
        for i in range(0, total, internal_step):
            frames_to_detect.add(i)
        for i in range(0, total, overlay_step):
            frames_to_detect.add(i)

        detection_cache = {}
        for i in sorted(frames_to_detect):
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frames[i])
            results = landmarker.detect(mp_image)

            if results.pose_landmarks and len(results.pose_landmarks) > 0:
                detection_cache[i] = results.pose_landmarks[0]

        # ── Build raw_results (internal, pixel coords) ──
        for i in range(0, total, internal_step):
            if i not in detection_cache:
                continue
            pose_lms = detection_cache[i]
            landmarks = {}
            for idx in [LM_NOSE, LM_LEFT_SHOULDER, LM_RIGHT_SHOULDER,
                        LM_LEFT_ELBOW, LM_RIGHT_ELBOW,
                        LM_LEFT_WRIST, LM_RIGHT_WRIST,
                        LM_LEFT_HIP, LM_RIGHT_HIP,
                        LM_LEFT_ANKLE, LM_RIGHT_ANKLE]:
                if idx < len(pose_lms):
                    lm = pose_lms[idx]
                    if lm.visibility > 0.5:
                        landmarks[idx] = (lm.x * frame_w, lm.y * frame_h)
            raw_results[i] = landmarks if len(landmarks) >= 4 else None

        # Forward-fill raw_results
        last_valid = None
        for i in range(total):
            if raw_results[i] is not None:
                last_valid = raw_results[i]
            elif last_valid is not None:
                raw_results[i] = last_valid

        # ── Build overlay_frames (normalized 0-1 coords) ──
        for i in range(0, total, overlay_step):
            if i not in detection_cache:
                continue
            pose_lms = detection_cache[i]
            lm_dict = {}
            for idx in OVERLAY_LM_INDICES:
                if idx < len(pose_lms):
                    lm = pose_lms[idx]
                    if lm.visibility > 0.3:
                        lm_dict[str(idx)] = [round(lm.x, 4), round(lm.y, 4)]
            overlay_frames[i] = {"lm": lm_dict} if len(lm_dict) >= 4 else None

        overlay_landmarks = {
            "step": overlay_step,
            "frames": overlay_frames,
        }

        return raw_results, overlay_landmarks

    def _compute_wrist_speed(self, pose_data, peak_idx, fps):
        """
        Compute wrist displacement speed (px/sec) around the peak frame.
        Uses the wrist that moves faster (dominant hand).
        Returns speed in pixels/sec or None if pose data unavailable.
        """
        window = 2
        start = max(0, peak_idx - window)
        end = min(len(pose_data) - 1, peak_idx + window)

        if start >= end:
            return None

        lm_start = pose_data[start]
        lm_end = pose_data[end]

        if lm_start is None or lm_end is None:
            return None

        best_speed = None
        dt = (end - start) / fps

        for wrist_idx in [LM_LEFT_WRIST, LM_RIGHT_WRIST]:
            if wrist_idx in lm_start and wrist_idx in lm_end:
                x1, y1 = lm_start[wrist_idx]
                x2, y2 = lm_end[wrist_idx]
                dist = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
                speed = dist / dt if dt > 0 else 0
                if best_speed is None or speed > best_speed:
                    best_speed = speed

        return best_speed

    # ═══════════════════════════════════════════════════════════════
    # Pose-based body measurements for calibration
    # ═══════════════════════════════════════════════════════════════

    def _measure_body_from_pose(self, pose_data):
        """
        Extract body measurements (in pixels) from pose data.
        Returns dict with available measurements and their pixel values.
        Uses median across all valid frames for robustness.
        """
        heights = []
        shoulder_widths = []
        arm_lengths = []

        for landmarks in pose_data:
            if landmarks is None:
                continue

            # Player height: ankle to nose
            ankle = None
            if LM_LEFT_ANKLE in landmarks and LM_RIGHT_ANKLE in landmarks:
                ax = (landmarks[LM_LEFT_ANKLE][0] + landmarks[LM_RIGHT_ANKLE][0]) / 2
                ay = (landmarks[LM_LEFT_ANKLE][1] + landmarks[LM_RIGHT_ANKLE][1]) / 2
                ankle = (ax, ay)
            elif LM_LEFT_ANKLE in landmarks:
                ankle = landmarks[LM_LEFT_ANKLE]
            elif LM_RIGHT_ANKLE in landmarks:
                ankle = landmarks[LM_RIGHT_ANKLE]

            if ankle and LM_NOSE in landmarks:
                nose = landmarks[LM_NOSE]
                h = abs(ankle[1] - nose[1])
                if h > 10:
                    heights.append(h)

            # Shoulder width
            if LM_LEFT_SHOULDER in landmarks and LM_RIGHT_SHOULDER in landmarks:
                ls = landmarks[LM_LEFT_SHOULDER]
                rs = landmarks[LM_RIGHT_SHOULDER]
                sw = np.sqrt((ls[0] - rs[0]) ** 2 + (ls[1] - rs[1]) ** 2)
                if sw > 5:
                    shoulder_widths.append(sw)

            # Arm length (shoulder to wrist, use both sides)
            for s_idx, w_idx in [(LM_LEFT_SHOULDER, LM_LEFT_WRIST),
                                 (LM_RIGHT_SHOULDER, LM_RIGHT_WRIST)]:
                if s_idx in landmarks and w_idx in landmarks:
                    s = landmarks[s_idx]
                    w = landmarks[w_idx]
                    al = np.sqrt((s[0] - w[0]) ** 2 + (s[1] - w[1]) ** 2)
                    if al > 5:
                        arm_lengths.append(al)

        result = {}
        if heights:
            result["height_px"] = float(np.median(heights))
        if shoulder_widths:
            result["shoulder_width_px"] = float(np.median(shoulder_widths))
        if arm_lengths:
            result["arm_length_px"] = float(np.median(arm_lengths))

        return result

    # ═══════════════════════════════════════════════════════════════
    # Optical flow
    # ═══════════════════════════════════════════════════════════════

    def _compute_optical_flows(self, frames, on_progress=None):
        """Compute per-frame-pair peak magnitude (99th percentile) using Farneback."""
        magnitudes = []
        total = len(frames) - 1
        for i in range(total):
            flow = cv2.calcOpticalFlowFarneback(
                frames[i], frames[i + 1],
                None, 0.5, 3, 15, 3, 5, 1.2, 0
            )
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            peak_mag = float(np.percentile(mag, 99))
            magnitudes.append(peak_mag)

            if on_progress and total > 0:
                pct = 15 + int((i + 1) / total * 60)
                on_progress(pct)
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

    def _auto_calibrate(self, gray_frames, rgb_frames, flow_magnitudes,
                        peak_idx, reference_length_cm, pose_data):
        """
        Multi-method automatic calibration with pose estimation.

        Methods (in order of confidence):
          1. Pose-based body measurements (height, shoulder width, arm length)
          2. Stick detection from optical flow (multi-frame consensus)
          3. Ridge-enhanced stick detection (scikit-image Frangi filter)
          4. Stick detection from edge/contour analysis
          5. Player height from motion silhouette (legacy fallback)
          6. Frame-proportional fallback

        Returns (cm_per_pixel, method_name).
        """
        frame_h, frame_w = gray_frames[0].shape[:2]
        stick_cm = reference_length_cm or STICK_LENGTH_CM
        estimates = []

        # ── Method 1: Pose-based body measurements (most reliable) ──
        body = self._measure_body_from_pose(pose_data)

        if "height_px" in body and body["height_px"] > 0:
            cm_px = PLAYER_HEIGHT_CM / body["height_px"]
            estimates.append(("pose_height", cm_px, 0.92))

        if "shoulder_width_px" in body and body["shoulder_width_px"] > 0:
            cm_px = SHOULDER_WIDTH_CM / body["shoulder_width_px"]
            estimates.append(("pose_shoulder", cm_px, 0.80))

        if "arm_length_px" in body and body["arm_length_px"] > 0:
            cm_px = ARM_LENGTH_CM / body["arm_length_px"]
            estimates.append(("pose_arm", cm_px, 0.75))

        # ── Method 2: Multi-frame stick detection via optical flow ──
        stick_flow_px = self._detect_stick_flow(gray_frames, flow_magnitudes, peak_idx)
        if stick_flow_px:
            cm_px = stick_cm / stick_flow_px
            estimates.append(("stick_flow", cm_px, 0.85))

        # ── Method 3: Ridge-enhanced stick detection ──
        stick_ridge_px = self._detect_stick_ridge(gray_frames, peak_idx)
        if stick_ridge_px:
            cm_px = stick_cm / stick_ridge_px
            estimates.append(("stick_ridge", cm_px, 0.70))

        # ── Method 4: Edge-based stick detection ──
        stick_edge_px = self._detect_stick_edges(gray_frames, peak_idx)
        if stick_edge_px:
            cm_px = stick_cm / stick_edge_px
            estimates.append(("stick_edge", cm_px, 0.60))

        # ── Method 5: Player height from motion silhouette (legacy) ──
        if not any(e[0].startswith("pose_") for e in estimates):
            player_px = self._detect_player_height(gray_frames)
            if player_px:
                cm_px = PLAYER_HEIGHT_CM / player_px
                estimates.append(("player_silhouette", cm_px, 0.40))

        if not estimates:
            fallback_px = frame_w * STICK_WIDTH_RATIO_FALLBACK
            return stick_cm / fallback_px, "fallback"

        return self._fuse_estimates(estimates)

    def _fuse_estimates(self, estimates):
        """
        Fuse calibration estimates. Uses weighted average of estimates
        that agree within 30% of the median.
        """
        estimates.sort(key=lambda e: e[2], reverse=True)
        primary = estimates[0]

        if len(estimates) >= 2:
            cm_values = [e[1] for e in estimates]
            median_cm = float(np.median(cm_values))

            agreeing = [e for e in estimates if 0.7 < e[1] / median_cm < 1.3]

            if len(agreeing) >= 2:
                total_w = sum(e[2] for e in agreeing)
                fused_cm = sum(e[1] * e[2] for e in agreeing) / total_w
                return fused_cm, primary[0]

        return primary[1], primary[0]

    # ═══════════════════════════════════════════════════════════════
    # Stick detection methods
    # ═══════════════════════════════════════════════════════════════

    def _detect_stick_flow(self, frames, flow_magnitudes, peak_idx):
        """Detect stick length from optical flow (multi-frame consensus)."""
        frame_h, frame_w = frames[0].shape[:2]
        peak_mag = flow_magnitudes[peak_idx]
        candidates = []

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

        median_px = float(np.median(candidates))
        inliers = [c for c in candidates if 0.75 < c / median_px < 1.25]
        return float(np.median(inliers)) if inliers else median_px

    def _extract_stick_from_flow(self, flow, frame_h, frame_w):
        """Extract stick-like elongated object from optical flow field."""
        mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])

        threshold = np.percentile(mag, 95)
        mask = (mag > threshold).astype(np.uint8) * 255

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._best_stick_contour(contours, frame_h, frame_w)

    def _detect_stick_ridge(self, frames, peak_idx):
        """
        Detect stick using Frangi ridge filter from scikit-image.
        Ridge filters detect tubular structures — perfect for hockey stick shafts.
        """
        idx = min(peak_idx, len(frames) - 2)
        frame_h, frame_w = frames[0].shape[:2]

        # Frame difference isolates motion
        diff = cv2.absdiff(frames[idx], frames[idx + 1])
        diff_norm = diff.astype(np.float64) / 255.0

        # Frangi filter detects tubular/ridge structures
        ridge = frangi(diff_norm, sigmas=range(1, 5), black_ridges=False)

        # Threshold the ridge response
        ridge_norm = (ridge / (ridge.max() + 1e-10) * 255).astype(np.uint8)
        _, mask = cv2.threshold(ridge_norm, 30, 255, cv2.THRESH_BINARY)

        # Cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._best_stick_contour(contours, frame_h, frame_w)

    def _detect_stick_edges(self, frames, peak_idx):
        """Detect stick from frame differencing and edge analysis."""
        idx = min(peak_idx, len(frames) - 2)
        frame_h, frame_w = frames[0].shape[:2]

        diff = cv2.absdiff(frames[idx], frames[idx + 1])
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

        kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3))
        kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 9))
        dilated = cv2.dilate(thresh, kernel_h, iterations=2)
        dilated = cv2.dilate(dilated, kernel_v, iterations=1)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        cleaned = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return self._best_stick_contour(contours, frame_h, frame_w)

    def _detect_player_height(self, frames):
        """Estimate player height from accumulated motion silhouette (legacy fallback)."""
        frame_h, frame_w = frames[0].shape[:2]

        motion_acc = np.zeros((frame_h, frame_w), dtype=np.float32)
        sample_step = max(1, (len(frames) - 1) // 60)

        for i in range(0, len(frames) - 1, sample_step):
            diff = cv2.absdiff(frames[i], frames[i + 1])
            motion_acc += diff.astype(np.float32)

        max_val = motion_acc.max()
        if max_val == 0:
            return None

        motion_norm = (motion_acc / max_val * 255).astype(np.uint8)
        _, mask = cv2.threshold(motion_norm, 40, 255, cv2.THRESH_BINARY)

        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        best_height = None
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < frame_h * frame_w * 0.005:
                continue
            _, _, w, h = cv2.boundingRect(contour)
            height_ratio = h / frame_h
            if height_ratio < PLAYER_FRAME_RATIO_MIN or height_ratio > PLAYER_FRAME_RATIO_MAX:
                continue
            if h < w * 1.2:
                continue
            if w / frame_w > 0.6:
                continue
            if best_height is None or h > best_height:
                best_height = h

        return float(best_height) if best_height else None

    # ═══════════════════════════════════════════════════════════════
    # Shared: stick contour scoring
    # ═══════════════════════════════════════════════════════════════

    def _best_stick_contour(self, contours, frame_h, frame_w):
        """Find the most stick-like contour. Returns length in pixels or None."""
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
                continue

            frame_ratio = length / frame_w
            if frame_ratio < STICK_FRAME_RATIO_MIN or frame_ratio > STICK_FRAME_RATIO_MAX:
                continue

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
        fps, frame_count, frame_height,
        pose_data=None, has_wrist_speed=False
    ):
        """
        Confidence score 0.0-1.0 based on:
        - Peak distinctness (0.30 weight)
        - Calibration quality (0.35 weight)
        - Video quality (0.15 weight)
        - Pose detection quality (0.20 weight)
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

        # ── Calibration quality ──
        method_scores = {
            "pose_height": 0.95,
            "pose_shoulder": 0.85,
            "pose_arm": 0.80,
            "stick_flow": 0.75,
            "stick_ridge": 0.65,
            "stick_edge": 0.55,
            "player_silhouette": 0.40,
            "fallback": 0.15,
        }
        cal_score = method_scores.get(cal_method, 0.15)
        if reference_provided:
            cal_score = min(1.0, cal_score + 0.05)

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

        # ── Pose detection quality ──
        pose_score = 0.0
        if pose_data:
            detected = sum(1 for p in pose_data if p is not None)
            pose_ratio = detected / len(pose_data)
            pose_score = min(1.0, pose_ratio * 1.5)  # >66% detection → full score
            if has_wrist_speed:
                pose_score = min(1.0, pose_score + 0.2)

        confidence = (
            0.30 * peak_score +
            0.35 * cal_score +
            0.15 * vid_score +
            0.20 * pose_score
        )
        return round(min(1.0, max(0.0, confidence)), 2)
