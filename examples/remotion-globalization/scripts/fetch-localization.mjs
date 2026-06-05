#!/usr/bin/env node
/**
 * fetch-localization.mjs
 *
 * Fetches a SpeechLab-dubbed audio track and translated captions for one
 * target language and writes them to public/<lang>/ so that Remotion can
 * render offline and deterministically.
 *
 * Usage:
 *   SPEECHLAB_EMAIL=you@example.com \
 *   SPEECHLAB_PASSWORD=yourpassword \
 *   SPEECHLAB_SOURCE_MEDIA_URL=https://your-cdn.com/promo-en.mp4 \
 *   node scripts/fetch-localization.mjs <language>
 *
 * Example:
 *   node scripts/fetch-localization.mjs es_la
 *   node scripts/fetch-localization.mjs fr
 *   node scripts/fetch-localization.mjs pt_br
 *
 * Or render all supported languages at once:
 *   for lang in es_la fr pt_br; do
 *     node scripts/fetch-localization.mjs "$lang"
 *   done
 *
 * Required environment variables (never hardcode credentials):
 *   SPEECHLAB_EMAIL            – account email
 *   SPEECHLAB_PASSWORD         – account password
 *   SPEECHLAB_SOURCE_MEDIA_URL – publicly accessible URL of the English promo video
 *
 * Optional:
 *   SPEECHLAB_POLL_INTERVAL_MS – polling interval in ms (default: 10000)
 *   SPEECHLAB_POLL_TIMEOUT_MS  – max wait time in ms  (default: 1800000 = 30 min)
 *
 * SpeechLab API base: https://translate-api.speechlab.ai/v1
 * (Never use the internal dev URL in public/committed files.)
 */

import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ───────────────────────────────────────────────────────────

const BASE_URL = "https://translate-api.speechlab.ai/v1";

const SUPPORTED_LANGUAGES = ["es_la", "fr", "pt_br"];

const POLL_INTERVAL_MS = Number(process.env.SPEECHLAB_POLL_INTERVAL_MS ?? 10_000);
const POLL_TIMEOUT_MS = Number(process.env.SPEECHLAB_POLL_TIMEOUT_MS ?? 1_800_000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

// ── Argument validation ─────────────────────────────────────────────────────

const language = process.argv[2];
if (!language) {
  console.error("Usage: node scripts/fetch-localization.mjs <language>");
  console.error(`Supported languages: ${SUPPORTED_LANGUAGES.join(", ")}`);
  process.exit(1);
}
if (!SUPPORTED_LANGUAGES.includes(language)) {
  console.error(`Unsupported language: ${language}`);
  console.error(`Supported: ${SUPPORTED_LANGUAGES.join(", ")}`);
  process.exit(1);
}

const { SPEECHLAB_EMAIL, SPEECHLAB_PASSWORD, SPEECHLAB_SOURCE_MEDIA_URL } = process.env;
if (!SPEECHLAB_EMAIL || !SPEECHLAB_PASSWORD || !SPEECHLAB_SOURCE_MEDIA_URL) {
  console.error(
    "Missing required env vars: SPEECHLAB_EMAIL, SPEECHLAB_PASSWORD, SPEECHLAB_SOURCE_MEDIA_URL"
  );
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper with JSON response parsing and error surfacing.
 * @param {string} path - Path relative to BASE_URL (e.g. '/auth/login')
 * @param {RequestInit} options
 * @returns {Promise<unknown>}
 */
async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`SpeechLab API ${res.status} at ${url}: ${body}`);
  }

  return res.json();
}

/** Sleep for `ms` milliseconds */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Step 1: Authenticate ─────────────────────────────────────────────────────
// POST /auth/login → JWT at tokens.accessToken.jwtToken

console.log("Step 1/5: Authenticating with SpeechLab...");
const authData = await apiRequest("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: SPEECHLAB_EMAIL, password: SPEECHLAB_PASSWORD }),
});

const token = authData?.tokens?.accessToken?.jwtToken;
if (!token) {
  throw new Error("Auth response did not contain tokens.accessToken.jwtToken");
}
console.log("  Authenticated successfully.");

const authHeader = { Authorization: `Bearer ${token}` };

// ── Step 2: Create project + dub ──────────────────────────────────────────────
// POST /projects/createProjectAndDub
// IMPORTANT: Use locale codes (es_la, fr, pt_br) — bare 'es' returns HTTP 400.
// Response is FLAT: { projectId, jobId, dubStatus }

console.log(`Step 2/5: Creating project and dubbing to ${language}...`);
const projectData = await apiRequest("/projects/createProjectAndDub", {
  method: "POST",
  headers: authHeader,
  body: JSON.stringify({
    projectName: `remotion-globalization-${language}-${Date.now()}`,
    sourceLanguage: "en",
    targetLanguage: language,
    mediaUrl: SPEECHLAB_SOURCE_MEDIA_URL,
  }),
});

// Response is flat — not nested under a 'data' key
const { projectId, jobId } = projectData;
console.log(`  projectId=${projectId}  jobId=${jobId}`);

// ── Step 3: Poll for dub completion ──────────────────────────────────────────
// GET /projects → translations[0].dub[0].status
// Key is 'dub' (singular), NOT 'dubs'.
// Terminal success: status === 'COMPLETE'.
// Also watch dub[0].mergeStatus for merge completion.

console.log("Step 3/5: Polling for dub completion...");
let dubComplete = false;
let translationId = null;
let mediaId = null;
const deadline = Date.now() + POLL_TIMEOUT_MS;

while (!dubComplete) {
  if (Date.now() > deadline) {
    throw new Error(`Dub did not complete within ${POLL_TIMEOUT_MS / 60_000} minutes`);
  }

  await sleep(POLL_INTERVAL_MS);

  // GET /projects returns the full project list; find ours by projectId
  const projects = await apiRequest("/projects", { headers: authHeader });
  const project = projects.find?.((p) => p.projectId === projectId || p._id === projectId);

  if (!project) {
    console.log("  Project not found yet, retrying...");
    continue;
  }

  const translation = project.translations?.[0];
  if (!translation) {
    console.log("  No translations yet, retrying...");
    continue;
  }

  // Note: key is 'dub' (singular) per verified API behaviour
  const dub = translation.dub?.[0];
  if (!dub) {
    console.log("  No dub entry yet, retrying...");
    continue;
  }

  const status = dub.status;
  const mergeStatus = dub.mergeStatus;
  console.log(`  dub.status=${status}  dub.mergeStatus=${mergeStatus}`);

  if (status === "COMPLETE") {
    dubComplete = true;
    translationId = translation._id ?? translation.translationId;
    mediaId = dub.mediaId ?? dub._id;
    console.log(`  Dub complete! translationId=${translationId}  mediaId=${mediaId}`);
  } else if (status === "FAILED" || status === "ERROR") {
    throw new Error(`Dub failed with status: ${status}`);
  }
}

// ── Step 4: Get presigned URL for dubbed audio ────────────────────────────────
// GET /medias/getMediaPresignedURL?projectId=<id>&mediaId=<opt>
// Returns the raw URL string (note: path uses plural 'medias').
// Alternatively: POST /medias/getMediaPresignedURL { fileKey } → { presignedUrl }

console.log("Step 4/5: Getting presigned URL for dubbed audio...");
let presignedUrl;

// Try GET variant first (primary documented endpoint)
const presignedParams = new URLSearchParams({ projectId });
if (mediaId) presignedParams.set("mediaId", mediaId);

const presignedResponse = await fetch(
  `${BASE_URL}/medias/getMediaPresignedURL?${presignedParams}`,
  { headers: { ...authHeader, "Content-Type": "application/json" } }
);

if (!presignedResponse.ok) {
  throw new Error(
    `Failed to get presigned URL: ${presignedResponse.status} ${await presignedResponse.text()}`
  );
}

const presignedBody = await presignedResponse.json();

// The endpoint returns the raw URL string directly, or { presignedUrl } depending on variant
if (typeof presignedBody === "string") {
  presignedUrl = presignedBody;
} else if (presignedBody?.presignedUrl) {
  presignedUrl = presignedBody.presignedUrl;
} else if (presignedBody?.url) {
  presignedUrl = presignedBody.url;
} else {
  throw new Error(`Unexpected presigned URL response shape: ${JSON.stringify(presignedBody)}`);
}

console.log(`  Got presigned URL (${presignedUrl.slice(0, 80)}...)`);

// ── Step 5: Download assets to public/<lang>/ ────────────────────────────────

const outDir = path.join(PUBLIC_DIR, language);
mkdirSync(outDir, { recursive: true });

console.log(`Step 5/5: Downloading assets to public/${language}/...`);

// Download dubbed audio
const audioPath = path.join(outDir, "audio.mp3");
const audioRes = await fetch(presignedUrl);
if (!audioRes.ok) {
  throw new Error(`Failed to download audio: ${audioRes.status}`);
}
await pipeline(Readable.fromWeb(audioRes.body), createWriteStream(audioPath));
console.log(`  Audio saved to public/${language}/audio.mp3`);

// Download translated SRT captions
// SRT download: try GET /translations/{translationId} and look for captions URL,
// or construct from the translation data. Fallback: attempt a captions presigned URL.
// This implementation uses the translation endpoint if translationId is available.
let srtContent = null;

if (translationId) {
  try {
    const translationDetail = await apiRequest(`/translations/${translationId}`, {
      headers: authHeader,
    });
    // Caption URLs are typically in translationDetail.captionsUrl or similar
    const captionsUrl =
      translationDetail?.captionsUrl ??
      translationDetail?.srtUrl ??
      translationDetail?.dub?.[0]?.captionsUrl;

    if (captionsUrl) {
      const srtRes = await fetch(captionsUrl);
      if (srtRes.ok) {
        srtContent = await srtRes.text();
      }
    }
  } catch (err) {
    console.warn(`  Could not fetch captions via /translations/${translationId}: ${err.message}`);
  }
}

const srtPath = path.join(outDir, "captions.srt");
if (srtContent) {
  writeFileSync(srtPath, srtContent, "utf8");
  console.log(`  Captions saved to public/${language}/captions.srt`);
} else {
  // Write a placeholder so Remotion does not crash during development
  const placeholder = `1\n00:00:00,000 --> 00:00:03,000\n[${language} captions not yet fetched]\n`;
  writeFileSync(srtPath, placeholder, "utf8");
  console.warn(
    `  WARNING: Could not fetch translated captions. ` +
    `Placeholder written to public/${language}/captions.srt. ` +
    `Manually download the SRT from the SpeechLab dashboard and replace it.`
  );
}

console.log(`\nDone! Assets are in public/${language}/`);
console.log(`Now render with:\n  npx remotion render src/Root.tsx Main --props='{"language":"${language}"}' --output=out/main-${language}.mp4`);
