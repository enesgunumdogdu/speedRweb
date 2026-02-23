import random
import threading
import time

import requests
from flask import Flask, request, jsonify

app = Flask(__name__)


def mock_analyze(callback_url: str):
    """Simulate analysis: wait 3 seconds, then post random speed result."""
    time.sleep(3)

    speed_kmh = round(random.uniform(80, 170), 1)
    speed_mph = round(speed_kmh * 0.621371, 1)
    confidence = round(random.uniform(0.75, 0.99), 2)

    payload = {
        "success": True,
        "speedKmh": speed_kmh,
        "speedMph": speed_mph,
        "confidence": confidence,
        "errorMessage": None,
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
    callback_url = data.get("callback_url")

    if not analysis_id or not callback_url:
        return jsonify({"error": "analysis_id and callback_url are required"}), 400

    print(f"Received analysis request: {analysis_id}")

    thread = threading.Thread(target=mock_analyze, args=(callback_url,))
    thread.start()

    return jsonify({"status": "accepted", "analysis_id": analysis_id}), 202


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "UP"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
