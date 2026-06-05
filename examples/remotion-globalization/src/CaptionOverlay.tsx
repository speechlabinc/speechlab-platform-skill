/**
 * CaptionOverlay.tsx — TikTok-style caption overlay for Remotion
 *
 * Displays the active caption for the current frame, styled as a bold
 * center-screen lower-third. The active caption is determined by comparing
 * the current time in milliseconds against each Caption's startMs / endMs.
 *
 * Layout is language-agnostic: RTL locales (ar_sa) are handled by setting
 * `direction: 'rtl'` via the `isRtl` prop so the same component works for
 * all SpeechLab-supported locales.
 */

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { TikTokPage } from "@remotion/captions";

export interface CaptionOverlayProps {
  /** TikTok-style pages produced by createTikTokStyleCaptions() in Main.tsx */
  pages: TikTokPage[];
  /** Set true for RTL languages (Arabic, Hebrew, etc.) */
  isRtl?: boolean;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  pages,
  isRtl = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /** Current playback time in milliseconds */
  const currentMs = (frame / fps) * 1000;

  /** Find the page whose time window contains the current frame */
  const activePage = useMemo<TikTokPage | null>(() => {
    for (const page of pages) {
      const endMs = page.startMs + page.durationMs;
      if (currentMs >= page.startMs && currentMs < endMs) {
        return page;
      }
    }
    return null;
  }, [pages, currentMs]);

  if (!activePage) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 180,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
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
        }}
      >
        {activePage.tokens.map((token, i) => {
          /** Highlight the token currently being spoken */
          const isActive =
            currentMs >= token.fromMs && currentMs < token.toMs;
          return (
            <span
              key={i}
              style={{
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1.25,
                letterSpacing: -0.5,
                color: isActive ? "#FFE44D" : "#FFFFFF",
                textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                transition: "color 0.08s ease",
                display: "inline",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
