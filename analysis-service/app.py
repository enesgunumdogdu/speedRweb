from __future__ import annotations

import threading
import traceback

import requests
from flask import Flask, request, jsonify

from analyzer import IceHockeyAnalyzer

app = Flask(__name__)
analyzer = IceHockeyAnalyzer()


def send_progress(progress_url: str, percent: int):
    """Send a progress update to the Spring Boot backend."""
    try:
        requests.post(progress_url, json={"progressPercent": percent}, timeout=5)
    except Exception:
        pass  # Non-critical: don't fail analysis if progress update fails


def run_analysis(video_path: str, reference_length_cm: float | None,
                 callback_url: str, progress_url: str | None,
                 player_height_cm: float | None = None):
    """Run the actual OpenCV analysis and post results to callback URL."""
    def on_progress(percent: int):
        if progress_url:
            send_progress(progress_url, percent)

    try:
        speed_kmh, speed_mph, confidence, frame_speeds_kmh, fps, overlay_landmarks = analyzer.analyze(
            video_path, reference_length_cm, on_progress=on_progress,
            player_height_cm=player_height_cm
        )
        payload = {
            "success": True,
            "speedKmh": speed_kmh,
            "speedMph": speed_mph,
            "confidence": confidence,
            "errorMessage": None,
            "frameData": {
                "fps": fps,
                "frameSpeeds": frame_speeds_kmh,
                "poseLandmarks": overlay_landmarks,
            },
        }
    except Exception as e:
        print(f"Analysis failed: {e}")
        traceback.print_exc()
        payload = {
            "success": False,
            "speedKmh": None,
            "speedMph": None,
            "confidence": None,
            "errorMessage": str(e),
            "frameData": None,
        }

    try:
        resp = requests.post(callback_url, json=payload, timeout=10)
        print(f"Callback sent to {callback_url} — status {resp.status_code}")
    except Exception as e:
        print(f"Callback failed: {e}")


@app.route("/analyze/ice-hockey", methods=["POST"])
def analyze_ice_hockey():
    data = request.get_json()
    analysis_id = data.get("analysis_id")
    video_path = data.get("video_path")
    callback_url = data.get("callback_url")
    progress_url = data.get("progress_url")
    reference_length_cm = data.get("reference_length_cm")
    player_height_cm = data.get("player_height_cm")

    if not analysis_id or not callback_url:
        return jsonify({"error": "analysis_id and callback_url are required"}), 400

    if not video_path:
        return jsonify({"error": "video_path is required"}), 400

    print(f"Received analysis request: {analysis_id} — video: {video_path}")

    thread = threading.Thread(
        target=run_analysis,
        args=(video_path, reference_length_cm, callback_url, progress_url, player_height_cm),
    )
    thread.start()

    return jsonify({"status": "accepted", "analysis_id": analysis_id}), 202


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "UP"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
