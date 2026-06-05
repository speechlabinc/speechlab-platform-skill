# Globalize Any Video with Claude and SpeechLab

You have a video in English. You want it in Spanish, French, and Portuguese — same speaker voice, translated captions, pixel-identical layout. The classical workflow is a spreadsheet of vendor timelines and a shared Dropbox of WAV files. This post describes a different approach: two tools that let Claude drive the entire pipeline programmatically, from a raw video URL to a rendered MP4 per locale.

---

## Table of Contents

1. [The pitch](#1-the-pitch)
2. [Two tools, one pipeline](#2-two-tools-one-pipeline)
3. [End-to-end example: English to Spanish (es_la)](#3-end-to-end-example-english-to-spanish-es_la)
4. [Remotion globalization pipeline](#4-remotion-globalization-pipeline)
5. [Real render evidence](#5-real-render-evidence)
6. [Resources](#6-resources)

---

## 1. The pitch

SpeechLab's dubbing API does two things at once: it voice-clones the original speaker to produce a dubbed audio track in the target language, and it generates time-aligned translated captions in SRT format. The dubbed audio sounds like the original speaker — not a generic TTS voice.

Those two artifacts (dubbed audio + translated captions) are everything Remotion needs to produce a re-rendered video that is geometrically identical to the source, just localized. The same composition renders in N languages by swapping `<Audio>` and caption data through a single `language` prop.

The result:

- One source video
- One Remotion composition
- N calls to the SpeechLab API
- N rendered MP4 files, each with cloned voice and live captions in the target language

No timeline editors. No batch-export UIs. Fully scriptable.

---

## 2. Two tools, one pipeline

### The Claude skill — `speechlab-platform-skill`

A Claude Code skill that teaches your agent to drive the SpeechLab API correctly. SpeechLab's live API diverges from its OpenAPI spec in several places — the JWT token path, the `createProjectAndDub` response shape, the `dub` vs `dubs` field inconsistency, and the presigned URL path. Without the skill, a cold agent hits these gotchas and guesses wrong. With the skill, it gets them right because the skill documents what the API actually does in production.

Benchmark: **15/15 assertions pass with the skill (100%)** versus 6/15 without it (40%).

**Install — Option A (plugin marketplace):**

```
/plugin marketplace add speechlabinc/speechlab-platform-skill
/plugin install speechlab-api@speechlab-platform-skill
```

**Install — Option B (manual clone):**

```bash
git clone https://github.com/speechlabinc/speechlab-platform-skill.git /tmp/sl-skill
mkdir -p .claude/skills
cp -R /tmp/sl-skill/speechlab-api/skills/speechlab-api .claude/skills/
```

For a user-scoped install that activates across all projects:

```bash
cp -R /tmp/sl-skill/speechlab-api/skills/speechlab-api ~/.claude/skills/
```

The skill activates automatically on phrases like `createProjectAndDub`, `dub pipeline`, `mergeStatus`, or `voiceMatchingMode`. You can also load it explicitly by opening with: _"Using the SpeechLab skill, ..."_

**Repository:** [github.com/speechlabinc/speechlab-platform-skill](https://github.com/speechlabinc/speechlab-platform-skill)

---

### The MCP server — `speechlab-mcp`

An MCP server that exposes the full SpeechLab platform as structured tools for Claude Desktop, Claude Code, and any MCP-compatible client. No curl, no SDK glue — just ask Claude to dub a video and the MCP server handles auth, polling, and artifact retrieval.

**Install via Claude Code CLI:**

```bash
claude mcp add speechlab npx speechlab-mcp \
  -e SPEECHLAB_EMAIL=you@example.com \
  -e SPEECHLAB_PASSWORD=yourpassword \
  -e SPEECHLAB_API_URL=https://translate-api.speechlab.ai/v1
```

**Install via `claude_desktop_config.json`:**

```json
{
  "mcpServers": {
    "speechlab": {
      "command": "npx",
      "args": ["-y", "speechlab-mcp"],
      "env": {
        "SPEECHLAB_EMAIL": "you@example.com",
        "SPEECHLAB_PASSWORD": "yourpassword",
        "SPEECHLAB_API_URL": "https://translate-api.speechlab.ai/v1"
      }
    }
  }
}
```

**Repository:** [github.com/speechlabinc/speechlab-mcp](https://github.com/speechlabinc/speechlab-mcp)

---

### How they relate

The Claude skill and the MCP server solve the same problem from different angles. The skill is for agent-driven, chat-based work — you describe what you want in natural language and Claude handles the API calls. The MCP server is for programmatic integration — it exposes discrete tools that any MCP client (or script) can call directly. Both target the same underlying SpeechLab REST API at `https://translate-api.speechlab.ai/v1`.

For the Remotion pipeline described below, `scripts/fetch-localization.mjs` hits the REST API directly. The skill or MCP server gives you the same result interactively.

---

## 3. End-to-end example: English to Spanish (es_la)

Base URL for all calls: `https://translate-api.speechlab.ai/v1`

All calls below are real. The `es_la` dub described here reached `COMPLETE` in a live test.

### Step 1 — Authenticate

```bash
curl -s -X POST https://translate-api.speechlab.ai/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@speechlab.ai","password":"yourpassword"}' \
  | jq '.tokens.accessToken.jwtToken'
```

The JWT is nested at `tokens.accessToken.jwtToken`. Not `tokens.access.token`, not `tokens.token`. This is the most common integration mistake — the skill documents this path explicitly.

Store the token:

```bash
TOKEN=$(curl -s -X POST https://translate-api.speechlab.ai/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@speechlab.ai","password":"yourpassword"}' \
  | jq -r '.tokens.accessToken.jwtToken')
```

### Step 2 — Create project and start dub

```bash
curl -s -X POST https://translate-api.speechlab.ai/v1/projects/createProjectAndDub \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "promo-es_la-2026-06-04",
    "sourceLanguage": "en",
    "targetLanguage": "es_la",
    "mediaUrl": "https://your-cdn.com/promo-en.mp4"
  }'
```

**Critical: use locale codes.** `es_la` is Latin American Spanish. `es` returns HTTP 400 — it is not in the accepted enum. The same rule applies throughout: use `es_es`, `fr`, `fr_ca`, `pt_br`, `pt_pt`, `ar_sa`, not bare ISO 639-1 codes.

The response is **flat**, not nested:

```json
{
  "projectId": "6a21f3c8cc1d8a77978e2dd4",
  "jobId": "6a21f4cf785f8f249262abc1",
  "dubStatus": "SUBMITTED"
}
```

Save `projectId` — you need it for polling and artifact download.

### Step 3 — Poll for completion

Use `GET /projects` (the list endpoint), not `GET /projects/{id}`. The single-project endpoint does not populate dub status.

```bash
curl -s https://translate-api.speechlab.ai/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | select(._id == "6a21f3c8cc1d8a77978e2dd4") | .translations[0].dub[0].status'
```

The field is `dub` (singular), not `dubs`. Using `dubs` returns `undefined` — another known API inconsistency that the skill documents.

Terminal values:

| Value | Meaning |
|---|---|
| `SUBMITTED` | Queued |
| `GENERATING` | ASR / MT running |
| `PROCESSING` | TTS synthesis + audio merge |
| `COMPLETE` | Dub and merge finished |
| `FAILED` | Non-recoverable error |

A minimal polling loop in Node.js:

```js
async function waitForDub(projectId, token, intervalMs = 10_000, timeoutMs = 1_800_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));
    const projects = await fetch('https://translate-api.speechlab.ai/v1/projects', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());

    const project = projects.find(p => p._id === projectId);
    const dub = project?.translations?.[0]?.dub?.[0];  // note: 'dub', singular
    console.log(`status=${dub?.status}  mergeStatus=${dub?.mergeStatus}`);
    if (dub?.status === 'COMPLETE') return dub;
    if (dub?.status === 'FAILED') throw new Error('Dub failed');
  }
  throw new Error('Timeout');
}
```

### Step 4 — Get presigned URL and download

The media endpoint path uses the plural `medias`. The query variant returns the raw URL string:

```bash
PRESIGNED=$(curl -s \
  "https://translate-api.speechlab.ai/v1/medias/getMediaPresignedURL?projectId=6a21f3c8cc1d8a77978e2dd4&mediaId=6a21f57b785f8f249262f3a6" \
  -H "Authorization: Bearer $TOKEN")

# $PRESIGNED is the raw URL string (an S3 signed URL)
curl -L "$PRESIGNED" -o promo-es_la.mp3
```

Alternatively, if you have a specific `fileKey`, use the POST variant which returns `{ presignedUrl }`:

```bash
curl -s -X POST https://translate-api.speechlab.ai/v1/medias/getMediaPresignedURL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileKey":"path/to/file.mp3"}' \
  | jq -r '.presignedUrl'
```

Note: `expand=true` on `GET /projects` does **not** presign media. It populates metadata only. To get a downloadable URL, always use `GET /medias/getMediaPresignedURL`.

---

## 4. Remotion globalization pipeline

[Remotion](https://www.remotion.dev) renders React components to video frames. The globalization pattern here: author one composition in English, fetch dubbed audio and translated SRT from SpeechLab per language, then render the same composition with a `language` prop that drives everything.

### Scaffold a Remotion project

```bash
npx create-video@latest --yes --blank --no-tailwind remotion-globalization
cd remotion-globalization
npm install
```

Install the Remotion skill for Claude Code assistance:

```bash
npx skills add remotion-dev/skills
```

### How the composition is parametrized

The `language` prop flows through a Zod schema. `calculateMetadata` in `Root.tsx` loads the pre-fetched assets for that language before the render starts — no network calls during rendering. This keeps renders deterministic and offline-capable.

```ts
// src/Root.tsx (excerpt)
export const compositionSchema = z.object({
  language: z.enum(["en", "es_la", "fr", "pt_br"]),
});

const calculateMetadata: CalculateMetadataFunction<CompositionInputProps> =
  async ({ props }) => {
    const localization = await loadLocalization(props.language);
    return {
      durationInFrames: Math.ceil(localization.durationSec * FPS),
      props: {
        language: props.language,
        audioSrc: localization.audioSrc,       // public/<lang>/audio.mp3
        captions: localization.captions,       // parsed from public/<lang>/captions.srt
        durationSec: localization.durationSec,
      },
    };
  };
```

Inside `Main.tsx`, `<Audio>` from `@remotion/media` plays the dubbed track. `createTikTokStyleCaptions` from `@remotion/captions` turns the flat caption array into word-level pages:

```tsx
// src/Main.tsx (excerpt)
import { Audio } from "@remotion/media";
import { createTikTokStyleCaptions } from "@remotion/captions";

export const MainComposition: React.FC<MainProps> = ({ language, audioSrc, captions }) => {
  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 400 }),
    [captions]
  );

  return (
    <AbsoluteFill>
      {/* Dubbed voice for this language — swapped by calculateMetadata */}
      <Audio src={audioSrc} />

      {/* TikTok-style active-word caption overlay */}
      <CaptionOverlay pages={pages} isRtl={RTL_LANGUAGES.has(language)} />
    </AbsoluteFill>
  );
};
```

The visual geometry (layout, fonts, animations) is identical across all language renders. Only `audioSrc` and `captions` change.

### Phase 1 — Fetch assets per language

`scripts/fetch-localization.mjs` handles the full API flow for one language and writes assets to `public/<lang>/`:

```bash
export SPEECHLAB_EMAIL="you@example.com"
export SPEECHLAB_PASSWORD="yourpassword"
export SPEECHLAB_SOURCE_MEDIA_URL="https://your-cdn.com/promo-en.mp4"

# Fetch one language
node scripts/fetch-localization.mjs es_la

# Or all at once
for lang in es_la fr pt_br; do
  node scripts/fetch-localization.mjs "$lang"
done
```

The script calls, in order:

1. `POST /auth/login` — extracts `tokens.accessToken.jwtToken`
2. `POST /projects/createProjectAndDub` — body: `{ projectName, sourceLanguage: 'en', targetLanguage: 'es_la', mediaUrl }` — response: flat `{ projectId, jobId, dubStatus }`
3. `GET /projects` in a loop until `translations[0].dub[0].status === 'COMPLETE'`
4. `GET /medias/getMediaPresignedURL?projectId=<id>` — downloads dubbed MP3 to `public/<lang>/audio.mp3`
5. Downloads translated SRT to `public/<lang>/captions.srt`

### Phase 2 — Render per language

```bash
# Single language
npx remotion render src/Root.tsx Main \
  --props='{"language":"es_la"}' \
  --output=out/main-es_la.mp4

# All languages, sequentially
for lang in en es_la fr pt_br; do
  npx remotion render src/Root.tsx Main \
    --props="{\"language\":\"$lang\"}" \
    --output="out/main-${lang}.mp4"
done
```

Each render calls `calculateMetadata`, which reads `public/<lang>/captions.srt` to set `durationInFrames` from the actual caption duration — no hardcoded frame count.

### Preview in Remotion Studio

```bash
npm run studio
# → http://localhost:3000
# Use the props panel to switch 'language' and preview any locale live
```

### Full pipeline diagram

```
English source video (publicly accessible URL)
          │
          ▼
  node scripts/fetch-localization.mjs <lang>
          │
          ├─ POST /auth/login                    → JWT
          ├─ POST /projects/createProjectAndDub  → { projectId, jobId, dubStatus }
          ├─ GET  /projects (poll)               → translations[0].dub[0].status === COMPLETE
          ├─ GET  /medias/getMediaPresignedURL    → download dubbed MP3
          └─ GET  /translations/<id>             → download translated SRT
          │
          ▼
  public/<lang>/audio.mp3       ← SpeechLab dubbed voice
  public/<lang>/captions.srt    ← SpeechLab translated captions
          │
          ▼
  npx remotion render src/Root.tsx Main --props='{"language":"<lang>"}'
          │
          ▼
  out/main-<lang>.mp4           ← 1080×1920, 30fps, localized
```

---

## 5. Real render evidence

A live test run produced the following results. These numbers are real — not illustrative.

```json
{
  "assetsFetched": true,
  "renderMode": "full-mp4",
  "captionsCount": 4,
  "enOutputBytes": 3974385,
  "esOutputBytes": 4200819,
  "esAudioBytes": 831781,
  "esDiffersFromEn": true
}
```

The English and Spanish MP4s differ by ~226 KB (6%). The Spanish MP4 is larger because the dubbed audio track carries more data than the English source for this clip — consistent with TTS-synthesized speech at a matching bitrate.

**API calls made during the test run (in order):**

```
POST https://translate-api.speechlab.ai/v1/auth/login
  → JWT extracted from tokens.accessToken.jwtToken

GET /medias/getMediaPresignedURL?projectId=6a21f3c8cc1d8a77978e2dd4&mediaId=6a21f57b785f8f249262f3a6
  → es_la dubbed MP3 presigned URL

GET /medias/getMediaPresignedURL?projectId=6a21f3c8cc1d8a77978e2dd4&mediaId=6a21f4cf785f8f249262f3a4
  → es_la SRT presigned URL

GET /transcriptions/6a21f44268fcb68e32857401
  → EN transcription segments + SRT media reference

GET /medias/getMediaPresignedURL?projectId=6a21f3c8cc1d8a77978e2dd4&mediaId=6a21f4a4785f8f249262f3a2
  → EN SRT presigned URL

GET /medias/getMediaPresignedURL?projectId=6a21f3c8cc1d8a77978e2dd4&mediaId=6a21f4a3cc1d8a77978e343b
  → EN vocals MP3 presigned URL
```

The en-to-es_la dub reached `COMPLETE` during this run. The Remotion still at frame 60 was produced with:

```bash
npx remotion still src/Root.tsx Main \
  --props='{"language":"en"}' \
  --frame=60 \
  --output=out/
```

This produced a PNG still from the English composition, confirming the composition renders without error and `calculateMetadata` resolves the English assets correctly. Full MP4 renders were confirmed for both `en` and `es_la` (see byte counts above).

**What was not tested in this run:** fr and pt_br fetches from scratch (assets for those locales were pre-staged). Arabic (ar_sa) RTL layout was authored but not rendered end-to-end in this session.

---

## 6. Resources

| Resource | Link |
|---|---|
| speechlab-platform-skill (Claude skill) | [github.com/speechlabinc/speechlab-platform-skill](https://github.com/speechlabinc/speechlab-platform-skill) |
| speechlab-mcp (MCP server) | [github.com/speechlabinc/speechlab-mcp](https://github.com/speechlabinc/speechlab-mcp) |
| Remotion globalization example | [`examples/remotion-globalization`](../examples/remotion-globalization) in this repo |
| SpeechLab platform | [translate.speechlab.ai](https://translate.speechlab.ai) |
| SpeechLab API reference (Swagger) | `https://translate-api.speechlab.ai/v1/docs` |
| Remotion docs | [remotion.dev/docs](https://www.remotion.dev/docs) |
| Remotion + Claude Code | [remotion.dev/docs/ai/claude-code](https://www.remotion.dev/docs/ai/claude-code) |
| Remotion captions API | [remotion.dev/docs/captions](https://www.remotion.dev/docs/captions) |

### Accepted language codes

| Code | Language |
|---|---|
| `es_la` | Spanish (Latin America) |
| `es_es` | Spanish (Spain) |
| `fr` | French |
| `fr_ca` | French (Canada) |
| `pt_br` | Portuguese (Brazil) |
| `pt_pt` | Portuguese (Portugal) |
| `ar_sa` | Arabic (Saudi Arabia) |

Bare codes (`es`, `pt`, `fr-CA`) return HTTP 400. Use the enum values above exactly as shown. Call `GET /languages` for the full current list.
