/**
 * CaptionOverlay.tsx — subtitle overlay for Remotion
 *
 * Shows exactly ONE caption — the cue whose [startMs, endMs) window contains
 * the current frame — styled as a bold center-screen lower-third. This is the
 * "Remotion slices in the translated subtitle" half of the pipeline: the cues
 * come from SpeechLab (translated), Remotion decides when each is on screen.
 *
 * Layout is language-agnostic: RTL locales (e.g. ar_sa) flip via `isRtl`.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "@remotion/captions";

export interface CaptionOverlayProps {
  /** Translated cues from SpeechLab (one sentence per cue) */
  captions: Caption[];
  /** Set true for RTL languages (Arabic, Hebrew, etc.) */
  isRtl?: boolean;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  captions,
  isRtl = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  /** The single cue on screen right now (if any) */
  const active = captions.find(
    (c) => currentMs >= c.startMs && currentMs < c.endMs
  );

  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 180,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 48px",
        direction: isRtl ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          borderRadius: 16,
          padding: "18px 28px",
          maxWidth: 860,
          textAlign: "center",
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontSize: 52,
          fontWeight: 800,
          lineHeight: 1.25,
          letterSpacing: -0.5,
          color: "#FFE44D",
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        {active.text}
      </div>
    </div>
  );
};
