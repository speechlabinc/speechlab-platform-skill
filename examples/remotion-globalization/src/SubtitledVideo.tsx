/**
 * SubtitledVideo.tsx — the real demo
 *
 * Plays the ACTUAL source video (public/source.mp4), mutes its original
 * English audio, plays the SpeechLab-dubbed track for the target language,
 * and has Remotion burn in the translated subtitles. This is "give Claude a
 * video → get it back translated, with subtitles" — on real footage.
 */

import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { z } from "zod";
import { CaptionOverlay } from "./CaptionOverlay";

const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});

export const subtitledSchema = z.object({
  language: z.enum(["en", "es_la", "fr", "pt_br"]),
  /** SpeechLab dubbed audio (or the original for 'en') */
  audioSrc: z.string(),
  /** Translated, time-aligned captions */
  captions: z.array(captionSchema),
  durationSec: z.number(),
});

export type SubtitledProps = z.infer<typeof subtitledSchema>;

const RTL_LANGUAGES = new Set(["ar_sa"]);

export const SubtitledVideo: React.FC<SubtitledProps> = ({
  language,
  audioSrc,
  captions,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Real source footage — original audio muted */}
      <OffthreadVideo src={staticFile("source.mp4")} muted />

      {/* SpeechLab dubbed voice track (cloned speaker, target language) */}
      <Audio src={audioSrc} />

      {/* Remotion burns in the translated subtitles */}
      <CaptionOverlay captions={captions} isRtl={RTL_LANGUAGES.has(language)} />
    </AbsoluteFill>
  );
};
