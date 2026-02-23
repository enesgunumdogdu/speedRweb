import { useRef, useEffect, useCallback, useState } from "react";
import type { FrameData } from "../api/videoApi";

interface SpeedOverlayProps {
  videoUrl: string;
  frameData: FrameData;
  peakSpeedKmh: number;
}

function speedToColor(speed: number, peak: number): string {
  if (peak <= 0) return "#4caf50";
  const ratio = Math.min(speed / peak, 1);
  if (ratio < 0.5) {
    const t = ratio / 0.5;
    const r = Math.round(76 + (255 - 76) * t);
    const g = Math.round(175 + (235 - 175) * t);
    const b = Math.round(80 - 80 * t);
    return `rgb(${r},${g},${b})`;
  }
  const t = (ratio - 0.5) / 0.5;
  const r = 255;
  const g = Math.round(235 - 235 * t);
  return `rgb(${r},${g},0)`;
}

export default function SpeedOverlay({ videoUrl, frameData, peakSpeedKmh }: SpeedOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);

  const { fps, frameSpeeds } = frameData;
  const totalFrames = frameSpeeds.length;
  const peakFrameIdx = frameSpeeds.indexOf(Math.max(...frameSpeeds));

  const getFrameIndex = useCallback(() => {
    const video = videoRef.current;
    if (!video) return 0;
    const idx = Math.floor(video.currentTime * fps);
    return Math.min(idx, totalFrames - 1);
  }, [fps, totalFrames]);

  useEffect(() => {
    const tick = () => {
      const idx = getFrameIndex();
      setCurrentFrameIdx(idx);
      setCurrentSpeed(frameSpeeds[idx] ?? 0);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [getFrameIndex, frameSpeeds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const maxSpeed = peakSpeedKmh > 0 ? peakSpeedKmh * 1.1 : 1;
    const padLeft = 45;
    const padRight = 10;
    const padTop = 10;
    const padBottom = 25;
    const graphW = w - padLeft - padRight;
    const graphH = h - padTop - padBottom;

    // Background
    ctx.fillStyle = "#12121a";
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "#252530";
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (graphH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      const val = ((gridLines - i) / gridLines * maxSpeed).toFixed(0);
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val, padLeft - 5, y + 4);
    }

    // Y-axis label
    ctx.save();
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px system-ui, sans-serif";
    ctx.translate(10, padTop + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("km/h", 0, 0);
    ctx.restore();

    // Speed line
    if (totalFrames > 1) {
      for (let i = 0; i < totalFrames - 1; i++) {
        const x1 = padLeft + (i / (totalFrames - 1)) * graphW;
        const x2 = padLeft + ((i + 1) / (totalFrames - 1)) * graphW;
        const y1 = padTop + graphH - (frameSpeeds[i] / maxSpeed) * graphH;
        const y2 = padTop + graphH - (frameSpeeds[i + 1] / maxSpeed) * graphH;

        ctx.strokeStyle = speedToColor(frameSpeeds[i], peakSpeedKmh);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Peak marker
    if (peakFrameIdx >= 0 && totalFrames > 1) {
      const px = padLeft + (peakFrameIdx / (totalFrames - 1)) * graphW;
      const py = padTop + graphH - (frameSpeeds[peakFrameIdx] / maxSpeed) * graphH;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${frameSpeeds[peakFrameIdx].toFixed(1)}`, px, py - 10);
    }

    // Playback position
    if (totalFrames > 1) {
      const posX = padLeft + (currentFrameIdx / (totalFrames - 1)) * graphW;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(posX, padTop);
      ctx.lineTo(posX, padTop + graphH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Time axis
    const duration = totalFrames / fps;
    const timeSteps = Math.min(5, Math.floor(duration));
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= timeSteps; i++) {
      const t = (i / timeSteps) * duration;
      const x = padLeft + (i / timeSteps) * graphW;
      ctx.fillText(`${t.toFixed(1)}s`, x, h - 5);
    }
  }, [frameSpeeds, totalFrames, peakSpeedKmh, peakFrameIdx, currentFrameIdx, fps]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const padLeft = 45;
    const padRight = 10;
    const graphW = rect.width - padLeft - padRight;
    const clickX = e.clientX - rect.left - padLeft;
    const ratio = Math.max(0, Math.min(1, clickX / graphW));
    const duration = totalFrames / fps;
    video.currentTime = ratio * duration;
  };

  const color = speedToColor(currentSpeed, peakSpeedKmh);

  return (
    <div>
      <div style={{
        position: "relative",
        background: "#000",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          style={{ width: "100%", maxHeight: "50vh", objectFit: "contain", display: "block" }}
        />
        <div style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(8px)",
          borderRadius: 8,
          padding: "6px 14px",
          pointerEvents: "none",
        }}>
          <div style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.1,
          }}>
            {currentSpeed.toFixed(1)}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#9ca3af", textAlign: "center" }}>km/h</div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: "100%",
            height: 140,
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            cursor: "crosshair",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
