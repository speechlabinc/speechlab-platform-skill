/**
 * speechlab.ts — SpeechLab localization loader for Remotion
 *
 * This module resolves the audio track and caption file for a given language.
 *
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 * The render pipeline has two phases:
 *
 *   Phase 1 – Fetch (scripts/fetch-localization.mjs)
 *     For each non-English language:
 *     1. POST /auth/login                      → JWT (tokens.accessToken.jwtToken)
 *     2. POST /projects/createProjectAndDub    → { projectId, jobId, dubStatus }
 *        body: { projectName, sourceLanguage: 'en', targetLanguage: '<lang>',
 *                mediaUrl: '<source-video-url>' }
 *        IMPORTANT: use locale codes (es_la, fr, pt_br) — bare 'es' returns HTTP 400.
 *     3. Poll GET /projects until
 *        translations[0].dub[0].status === 'COMPLETE'
 *        (key is 'dub' singular, NOT 'dubs')
 *     4. GET /medias/getMediaPresignedURL?projectId=<id>
 *        → raw URL string for the dubbed audio
 *     5. Download dubbed audio → public/<lang>/audio.mp3
 *     6. Download translated SRT captions → public/<lang>/captions.srt
 *
 *   Phase 2 – Render (Remotion)
 *     calculateMetadata (Root.tsx) calls loadLocalization(language) below.
 *     Assets are already in public/<lang>/ — no network calls at render time.
 *     This keeps renders deterministic and offline-capable.
 *
 * BASE URL: https://translate-api.speechlab.ai/v1
 * (Never use the internal dev server in any public or committed file.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Caption } from "@remotion/captions";
import { staticFile } from "remotion";
import type { Language, LocalizationData } from "./types";

/**
 * Parses an SRT caption file fetched from the Remotion public directory.
 *
 * @param srtPath - staticFile()-resolved path, e.g. staticFile('en/captions.srt')
 */

/**
 * Computes the total duration in seconds from a Caption array.
 * Falls back to the endMs of the last caption if needed.
 */
function captionsDurationSec(captions: Caption[]): number {
  if (captions.length === 0) return 0;
  const last = captions[captions.length - 1];
  return last.endMs / 1000;
}

/**
 * loadLocalization — the single entry-point called from calculateMetadata.
 *
 * For 'en' (source language):
 *   Reads from public/en/ — the original audio and captions you placed there
 *   before rendering. No SpeechLab API call required.
 *
 * For all other languages (es_la, fr, pt_br, ...):
 *   Reads from public/<lang>/ — assets pre-fetched by scripts/fetch-localization.mjs.
 *   Run that script once per language before invoking `npx remotion render`.
 *
 * @param language - One of the supported Language values
 * @returns LocalizationData consumed by Root.tsx calculateMetadata and Main.tsx
 */
export async function loadLocalization(
  language: Language
): Promise<LocalizationData> {
  // All assets live under public/<lang>/ regardless of language.
  // For English this is the original source; for others it's SpeechLab output.
  const audioSrc = staticFile(`${language}/audio.mp3`);

  // Captions come from SpeechLab as { start, end, text } seconds. We load the
  // JSON (one cue per sentence) and map to Remotion's Caption shape — one cue
  // per page, so exactly one translated subtitle is on screen at a time.
  const res = await fetch(staticFile(`${language}/captions.json`));
  const cues = (await res.json()) as Array<{ start: number; end: number; text: string }>;
  const captions: Caption[] = cues.map((c) => ({
    text: c.text,
    startMs: Math.round(c.start * 1000),
    endMs: Math.round(c.end * 1000),
    timestampMs: Math.round(c.start * 1000),
    confidence: 1,
  }));
  const durationSec = captionsDurationSec(captions);

  return { audioSrc, captions, durationSec };
}
