"use client";

import { useEffect, useRef } from "react";

type UniversePoint = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
};

const POINT_COUNT = 176;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function createPoints(): UniversePoint[] {
  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const normalized = index / (POINT_COUNT - 1);
    const y = 1 - normalized * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * GOLDEN_ANGLE;

    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
      size: 0.55 + ((index * 17) % 11) / 16,
      phase: (index * 0.37) % (Math.PI * 2),
    };
  });
}

const points = createPoints();

/**
 * A lightweight canvas alternative to a WebGL hero scene.
 * The animation is intentionally self-contained so the storefront does not
 * need a global Three.js runtime just for one decorative visual.
 */
export function ProductUniverse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return undefined;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0 };
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let reducedMotion = motionQuery.matches;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = (time: number) => {
      if (!width || !height) {
        return;
      }

      context.clearRect(0, 0, width, height);

      const centerX = width * 0.52;
      const centerY = height * 0.5;
      const radius = Math.min(width, height) * 0.34;
      const rotation = reducedMotion ? -0.18 : time * 0.00016;
      const yaw = rotation + pointer.x * 0.28;
      const pitch = pointer.y * 0.2;
      const projected = points.map((point) => {
        const rotatedX = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
        const rotatedZ = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
        const rotatedY = point.y * Math.cos(pitch) - rotatedZ * Math.sin(pitch);
        const depth = point.y * Math.sin(pitch) + rotatedZ * Math.cos(pitch);
        const scale = 0.82 + (depth + 1) * 0.1;

        return {
          x: centerX + rotatedX * radius,
          y: centerY + rotatedY * radius,
          depth,
          size: point.size * scale,
          phase: point.phase,
        };
      });

      const glow = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.12,
        centerX,
        centerY,
        radius * 1.35
      );
      glow.addColorStop(0, "rgba(255, 246, 224, 0.5)");
      glow.addColorStop(0.42, "rgba(78, 160, 145, 0.16)");
      glow.addColorStop(1, "rgba(78, 160, 145, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.45, 0, Math.PI * 2);
      context.fill();

      context.lineWidth = 0.7;
      for (let index = 0; index < projected.length; index += 1) {
        const point = projected[index];
        const neighbour = projected[(index + 13) % projected.length];
        const distance = Math.hypot(point.x - neighbour.x, point.y - neighbour.y);

        if (distance > radius * 0.42 || point.depth < -0.72) {
          continue;
        }

        const lineAlpha = Math.max(0, 0.16 - distance / (radius * 4));
        context.strokeStyle = `rgba(15, 118, 110, ${lineAlpha})`;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(neighbour.x, neighbour.y);
        context.stroke();
      }

      projected
        .slice()
        .sort((first, second) => first.depth - second.depth)
        .forEach((point, index) => {
          const depthAlpha = 0.18 + ((point.depth + 1) / 2) * 0.72;
          const pulse = reducedMotion ? 1 : 0.9 + Math.sin(time * 0.0012 + point.phase) * 0.1;
          const alpha = Math.max(0.08, Math.min(0.92, depthAlpha * pulse));
          const color = index % 9 === 0 ? `rgba(180, 83, 9, ${alpha})` : `rgba(15, 118, 110, ${alpha})`;

          context.fillStyle = color;
          context.beginPath();
          context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
          context.fill();
        });
    };

    const tick = (time: number) => {
      render(time);
      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      if (reducedMotion) {
        render(0);
      }
    };

    const onPointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
      if (reducedMotion) {
        render(0);
      }
    };

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      window.cancelAnimationFrame(animationFrame);
      render(0);
      if (!reducedMotion) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    motionQuery.addEventListener("change", onMotionPreferenceChange);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    render(0);

    if (!reducedMotion) {
      animationFrame = window.requestAnimationFrame(tick);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionPreferenceChange);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="productUniverseCanvas" aria-hidden="true" />;
}
