/**
 * Main.tsx — Language-agnostic vertical promo composition
 *
 * Renders a short-form 9:16 promo with:
 *   - A gradient background (language-agnostic)
 *   - Animated hero text and brand elements
 *   - <Audio> for the dubbed voice track
 *   - <CaptionOverlay> for TikTok-style live captions
 *
 * All language-specific content (audio URL, captions) is passed in as props,
 * resolved by calculateMetadata in Root.tsx before the render begins.
 * The visual geometry is identical across all languages.
 *
 * EXPORTS
 *   mainSchema        — Zod schema used by Root.tsx <Composition schema={...}>
 *   MainComposition   — the renderable React component
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { CaptionOverlay } from "./CaptionOverlay";
import type { Language } from "./types";

// ── Zod schema ───────────────────────────────────────────────────────────────
// Defining props as a Zod schema (rather than an TS interface) satisfies the
// Remotion `Record<string, unknown>` constraint on Composition's generic, and
// also lets Remotion Studio render a UI form for the props.

const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});

/**
 * Full schema for <Composition>. The language, audioSrc, and captions fields
 * are all that calculateMetadata in Root.tsx injects before a render.
 */
export const mainSchema = z.object({
  /** SpeechLab locale code, or 'en' for the source language */
  language: z.enum(["en", "es_la", "fr", "pt_br"]),
  /**
   * Resolved audio URL (staticFile path) for this language.
   * 'en'    → public/en/audio.mp3  (original recording)
   * others  → public/<lang>/audio.mp3 (SpeechLab dubbed output)
   */
  audioSrc: z.string(),
  /** Parsed captions from public/<lang>/captions.srt */
  captions: z.array(captionSchema),
  /** Total duration in seconds — used by calculateMetadata for durationInFrames */
  durationSec: z.number(),
});

export type MainProps = z.infer<typeof mainSchema>;

// ── RTL support ──────────────────────────────────────────────────────────────

/** RTL language codes among the supported set */
const RTL_LANGUAGES = new Set<Language>(["ar_sa" as Language]);

// ── Component ────────────────────────────────────────────────────────────────

export const MainComposition: React.FC<MainProps> = ({
  language,
  audioSrc,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const isRtl = RTL_LANGUAGES.has(language as Language);

  // ── Entrance animations ────────────────────────────────────────────────────

  /** Logo + tagline slide-in spring */
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.9 },
    durationInFrames: 40,
  });

  /** Hero headline scale-up */
  const headlineSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 22, stiffness: 100, mass: 1 },
    durationInFrames: 45,
  });

  /** Fade-out in the final 30 frames */
  const globalOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames - 5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Animated badge pulse (draws eye to the language badge) ─────────────────
  const badgePulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.96, 1.04]
  );

  return (
    <AbsoluteFill
      style={{
        opacity: globalOpacity,
        background:
          "linear-gradient(160deg, #0D0D1A 0%, #1A0A2E 55%, #0A1A1F 100%)",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient background layer ───────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "radial-gradient(ellipse 70% 50% at 20% 30%, rgba(98,0,234,0.25) 0%, transparent 70%)",
            "radial-gradient(ellipse 60% 40% at 80% 70%, rgba(0,188,212,0.18) 0%, transparent 65%)",
            "radial-gradient(ellipse 40% 60% at 50% 50%, rgba(255,64,129,0.08) 0%, transparent 60%)",
          ].join(", "),
        }}
      />

      {/* ── Geometric accent lines ─────────────────────────────────────────── */}
      <svg
        aria-hidden
        viewBox="0 0 1080 1920"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.15,
        }}
      >
        <line
          x1="0"
          y1="640"
          x2="1080"
          y2="400"
          stroke="#6200EA"
          strokeWidth="1.5"
        />
        <line
          x1="0"
          y1="1100"
          x2="1080"
          y2="1300"
          stroke="#00BCD4"
          strokeWidth="1"
        />
        <circle
          cx="900"
          cy="240"
          r="180"
          fill="none"
          stroke="#FF4081"
          strokeWidth="1"
        />
        <circle
          cx="180"
          cy="1680"
          r="120"
          fill="none"
          stroke="#6200EA"
          strokeWidth="0.8"
        />
      </svg>

      {/* ── Dubbed audio track ─────────────────────────────────────────────── */}
      {/*
          audioSrc is resolved in speechlab.ts loadLocalization():
          - 'en'    → staticFile('en/audio.mp3')     (original source recording)
          - others  → staticFile('<lang>/audio.mp3')  (SpeechLab dubbed output,
                       fetched via GET /medias/getMediaPresignedURL and cached
                       to public/<lang>/ by scripts/fetch-localization.mjs)
      */}
      <Audio src={audioSrc} />

      {/* ── Brand logo / wordmark ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${interpolate(logoSpring, [0, 1], [-40, 0])}px)`,
          opacity: logoSpring,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Pill logo mark */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6200EA 0%, #00BCD4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 32px rgba(98,0,234,0.6)",
            }}
          >
            <svg viewBox="0 0 32 32" width={32} height={32}>
              <path
                d="M8 22 Q16 8 24 22"
                stroke="white"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="16" cy="24" r="2.5" fill="white" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              fontSize: 36,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: 0.5,
            }}
          >
            SpeechLab
          </span>
        </div>
      </div>

      {/* ── Hero section ────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 320,
          left: 64,
          right: 64,
          textAlign: "center",
          transform: `scale(${interpolate(headlineSpring, [0, 1], [0.88, 1])})`,
          opacity: headlineSpring,
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#00BCD4",
            margin: "0 0 24px",
          }}
        >
          One Video
        </p>

        {/* Main headline */}
        <h1
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: 96,
            fontWeight: 900,
            lineHeight: 1.05,
            color: "#FFFFFF",
            margin: "0 0 32px",
            letterSpacing: -2,
          }}
        >
          Every
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #6200EA 0%, #00BCD4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Language.
          </span>
        </h1>

        {/* Subheadline */}
        <p
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: 38,
            fontWeight: 400,
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          AI-dubbed voice · translated captions
          <br />
          pixel-perfect re-renders with Remotion
        </p>
      </div>

      {/* ── Language badge ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 900,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: `scale(${badgePulse})`,
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(255,255,255,0.18)",
            borderRadius: 100,
            padding: "20px 48px",
            backdropFilter: "blur(12px)",
          }}
        >
          <span
            style={{
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              fontSize: 32,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {language}
          </span>
        </div>
      </div>

      {/* ── Feature pills ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 1040,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          padding: "0 48px",
          opacity: interpolate(frame, [20, 50], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {[
          { icon: "🎙", label: "AI Voice Dubbing" },
          { icon: "💬", label: "Translated Captions" },
          { icon: "🎬", label: "Remotion Re-Render" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              width: "100%",
              maxWidth: 720,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 20,
              padding: "24px 32px",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <span style={{ fontSize: 36 }}>{icon}</span>
            <span
              style={{
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontSize: 32,
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── TikTok-style caption overlay ───────────────────────────────────── */}
      <CaptionOverlay captions={captions} isRtl={isRtl} />
    </AbsoluteFill>
  );
};
