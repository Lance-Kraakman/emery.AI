"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * AnimatedBackground
 * Subtle, professional animated background using blurred blobs and theme colors.
 * - Uses theme CSS variables for color (adapts to light/dark mode)
 * - Respects prefers-reduced-motion
 */
export default function AnimatedBackground() {
  const [isMounted, setIsMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  // Responsive to window size for blob positioning
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setIsMounted(true);
    function handleResize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isMounted) {
    return null;
  }

  // Animation variants for blobs
  const blobVariants = (xRange: [number, number], yRange: [number, number]) => ({
    animate: {
      x: prefersReducedMotion ? 0 : [xRange[0], xRange[1], xRange[0]],
      y: prefersReducedMotion ? 0 : [yRange[0], yRange[1], yRange[0]],
      transition: {
        duration: 24,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut" as const,
      },
    },
  });

  // Colors from theme CSS variables
  const colors = [
    "hsl(var(--primary) / 0.18)",
    "hsl(var(--accent) / 0.16)",
    "hsl(var(--chart-2) / 0.13)",
  ];

  // Blob positions and sizes (relative to viewport)
  const blobs = [
    {
      size: Math.max(dimensions.width, dimensions.height) * 0.6,
      style: { top: "-15%", left: "-10%" },
      variants: blobVariants(
        [0, 60],
        [0, 40]
      ),
      color: colors[0],
      blur: 80,
    },
    {
      size: Math.max(dimensions.width, dimensions.height) * 0.5,
      style: { bottom: "-10%", right: "-15%" },
      variants: blobVariants(
        [0, -50],
        [0, 50]
      ),
      color: colors[1],
      blur: 100,
    },
    {
      size: Math.max(dimensions.width, dimensions.height) * 0.4,
      style: { top: "40%", left: "60%" },
      variants: blobVariants(
        [0, 40],
        [0, -40]
      ),
      color: colors[2],
      blur: 60,
    },
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 w-full h-full z-0 overflow-hidden min-h-screen"
      style={{ isolation: "isolate" }}
    >
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          initial={false}
          animate="animate"
          variants={blob.variants}
          style={{
            position: "absolute",
            width: blob.size,
            height: blob.size,
            borderRadius: "50%",
            background: blob.color,
            filter: `blur(${blob.blur}px)`,
            ...blob.style,
            opacity: 0.85,
            willChange: "transform, opacity",
            transition: "opacity 0.5s",
          }}
        />
      ))}
    </div>
  );
}
