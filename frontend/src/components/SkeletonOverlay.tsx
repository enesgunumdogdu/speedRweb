import { useRef, useEffect, useCallback } from "react";
import type { PoseLandmarks } from "../api/videoApi";

interface SkeletonOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  poseLandmarks: PoseLandmarks;
  fps: number;
}

// Skeleton bone connections: [from, to]
const BONES: [number, number][] = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
];

// Wrist landmarks get a different color
const WRIST_IDS = new Set([15, 16]);

const BONE_COLOR = "rgba(0, 210, 210, 0.8)";
const JOINT_COLOR = "rgba(0, 210, 210, 0.9)";
const WRIST_COLOR = "rgba(255, 140, 0, 1)";
const BONE_WIDTH = 2.5;
const JOINT_RADIUS = 4;
const WRIST_RADIUS = 5;

type LmMap = Record<string, [number, number]>;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpLandmarks(a: LmMap, b: LmMap, t: number): LmMap {
  const result: LmMap = {};
  for (const key of Object.keys(a)) {
    if (key in b) {
      result[key] = [lerp(a[key][0], b[key][0], t), lerp(a[key][1], b[key][1], t)];
    } else {
      result[key] = a[key];
    }
  }
  return result;
}

function getLandmarksAtFrame(poseLandmarks: PoseLandmarks, frameIdx: number): LmMap | null {
  const { step, frames } = poseLandmarks;
  const totalFrames = frames.length;

  if (frameIdx < 0 || frameIdx >= totalFrames) return null;

  // Find surrounding sampled frames
  const lower = Math.floor(frameIdx / step) * step;
  const upper = lower + step;

  const lowerData = lower < totalFrames ? frames[lower] : null;
  const upperData = upper < totalFrames ? frames[upper] : null;

  if (lowerData && upperData) {
    const t = (frameIdx - lower) / step;
    return lerpLandmarks(lowerData.lm, upperData.lm, t);
  }
  if (lowerData) return lowerData.lm;
  if (upperData) return upperData.lm;

  // Fallback: scan nearest available frame
  for (let d = 1; d <= step * 2; d++) {
    if (frameIdx - d >= 0 && frames[frameIdx - d]) return frames[frameIdx - d]!.lm;
    if (frameIdx + d < totalFrames && frames[frameIdx + d]) return frames[frameIdx + d]!.lm;
  }
  return null;
}

function computeLetterbox(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number
): { offsetX: number; offsetY: number; renderW: number; renderH: number } {
  if (videoW <= 0 || videoH <= 0) {
    return { offsetX: 0, offsetY: 0, renderW: containerW, renderH: containerH };
  }
  const containerAR = containerW / containerH;
  const videoAR = videoW / videoH;

  let renderW: number, renderH: number;
  if (videoAR > containerAR) {
    // Video wider than container — pillarbox top/bottom
    renderW = containerW;
    renderH = containerW / videoAR;
  } else {
    // Video taller — letterbox left/right
    renderH = containerH;
    renderW = containerH * videoAR;
  }
  return {
    offsetX: (containerW - renderW) / 2,
    offsetY: (containerH - renderH) / 2,
    renderW,
    renderH,
  };
}

export default function SkeletonOverlay({ videoRef, poseLandmarks, fps }: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const frameIdx = Math.floor(video.currentTime * fps);
    const landmarks = getLandmarksAtFrame(poseLandmarks, frameIdx);

    if (landmarks) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const { offsetX, offsetY, renderW, renderH } = computeLetterbox(cw, ch, vw, vh);

      const toX = (nx: number) => offsetX + nx * renderW;
      const toY = (ny: number) => offsetY + ny * renderH;

      // Neck: midpoint of shoulders → nose
      const s11 = landmarks["11"];
      const s12 = landmarks["12"];
      const nose = landmarks["0"];
      if (s11 && s12 && nose) {
        const midX = (s11[0] + s12[0]) / 2;
        const midY = (s11[1] + s12[1]) / 2;
        ctx.strokeStyle = BONE_COLOR;
        ctx.lineWidth = BONE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(toX(nose[0]), toY(nose[1]));
        ctx.lineTo(toX(midX), toY(midY));
        ctx.stroke();
      }

      // Draw bones
      ctx.strokeStyle = BONE_COLOR;
      ctx.lineWidth = BONE_WIDTH;
      ctx.lineCap = "round";
      for (const [a, b] of BONES) {
        const pa = landmarks[String(a)];
        const pb = landmarks[String(b)];
        if (pa && pb) {
          ctx.beginPath();
          ctx.moveTo(toX(pa[0]), toY(pa[1]));
          ctx.lineTo(toX(pb[0]), toY(pb[1]));
          ctx.stroke();
        }
      }

      // Draw joints
      for (const [key, [nx, ny]] of Object.entries(landmarks)) {
        const id = Number(key);
        const isWrist = WRIST_IDS.has(id);
        ctx.fillStyle = isWrist ? WRIST_COLOR : JOINT_COLOR;
        const r = isWrist ? WRIST_RADIUS : JOINT_RADIUS;
        ctx.beginPath();
        ctx.arc(toX(nx), toY(ny), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    animRef.current = requestAnimationFrame(draw);
  }, [videoRef, poseLandmarks, fps]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Sync canvas size with video element via ResizeObserver
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ro = new ResizeObserver(() => {
      canvas.style.width = `${video.clientWidth}px`;
      canvas.style.height = `${video.clientHeight}px`;
    });
    ro.observe(video);
    // Initial sync
    canvas.style.width = `${video.clientWidth}px`;
    canvas.style.height = `${video.clientHeight}px`;

    return () => ro.disconnect();
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
}
