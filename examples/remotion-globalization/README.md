# SpeechLab x Remotion Globalization Example

Author a short-form vertical promo **once in English**. SpeechLab dubs the voice and translates the captions into other languages. Remotion re-renders pixel-identical localized cuts — all driven by a single `language` prop.

## What This Does

```
English promo (source)
       │
       ▼
SpeechLab API ──► AI voice dubbing (es_la, fr, pt_br, ...)
                ──► Caption translation (SRT)
       │
       ▼
public/<lang>/audio.mp3      ← dubbed audio
public/<lang>/captions.srt   ← translated captions
       │
       ▼
Remotion render --props='{"language":"es_la"}'
       │
       ▼
out/main-es_la.mp4  (pixel-identical geometry, localized content)
```

## Project Structure

```
remotion-globalization/
├── src/
│   ├── Root.tsx          — Remotion composition registry (<Composition> + calculateMetadata)
│   ├── Main.tsx          — Language-agnostic visual composition + Audio + CaptionOverlay
│   ├── CaptionOverlay.tsx — TikTok-style active-word caption component
│   ├── speechlab.ts      — Localization loader (reads public/<lang>/ at render time)
│   └── types.ts          — Shared TypeScript types (Language, LocalizationData)
├── scripts/
│   └── fetch-localization.mjs — Fetch SpeechLab dubbed audio + captions → public/<lang>/
├── public/
│   ├── en/               — Source English assets (place your audio.mp3 + captions.srt here)
│   ├── es_la/            — Fetched by fetch-localization.mjs
│   ├── fr/
│   └── pt_br/
├── remotion.config.ts
├── tsconfig.json
└── package.json
```

## Prerequisites

- Node 18+
- A SpeechLab account at https://www.speechlab.ai
- Your English promo video hosted at a publicly accessible URL

## Step 1 — Place Your English Source Assets

Copy your English audio track and SRT captions to `public/en/`:

```
public/en/audio.mp3        ← original English voice recording
public/en/captions.srt     ← English captions in SRT format
```

If your source is a video file, extract the audio first (e.g. with ffmpeg):

```bash
ffmpeg -i promo-en.mp4 -q:a 0 -map a public/en/audio.mp3
```

## Step 2 — Fetch Dubbed Assets with SpeechLab

Set your credentials as environment variables (never hardcode them):

```bash
export SPEECHLAB_EMAIL="you@example.com"
export SPEECHLAB_PASSWORD="yourpassword"
export SPEECHLAB_SOURCE_MEDIA_URL="https://your-cdn.com/promo-en.mp4"
```

Then fetch each target language:

```bash
node scripts/fetch-localization.mjs es_la
node scripts/fetch-localization.mjs fr
node scripts/fetch-localization.mjs pt_br
```

Or all at once:

```bash
for lang in es_la fr pt_br; do
  node scripts/fetch-localization.mjs "$lang"
done
```

The script will:
1. Authenticate with the SpeechLab API (`POST /auth/login`)
2. Create a dubbing project (`POST /projects/createProjectAndDub`)
3. Poll until the dub is complete (`GET /projects` → `translations[0].dub[0].status === 'COMPLETE'`)
4. Download the dubbed audio via presigned URL (`GET /medias/getMediaPresignedURL?projectId=...`)
5. Download the translated SRT captions
6. Write both to `public/<lang>/`

**SpeechLab API base URL:** `https://translate-api.speechlab.ai/v1`

**Accepted locale codes** (use these exactly — bare `es` returns HTTP 400):

| Code    | Language                    |
|---------|-----------------------------|
| `es_la` | Spanish (Latin America)     |
| `es_es` | Spanish (Spain)             |
| `fr`    | French                      |
| `fr_ca` | French (Canada)             |
| `pt_br` | Portuguese (Brazil)         |
| `pt_pt` | Portuguese (Portugal)       |
| `ar_sa` | Arabic (Saudi Arabia)       |

## Step 3 — Open in Remotion Studio

```bash
npm run studio
```

Use the Studio UI to switch the `language` prop and preview each localized cut.

## Step 4 — Render Localized Cuts

```bash
# Single language
npx remotion render src/Root.tsx Main \
  --props='{"language":"es_la"}' \
  --output=out/main-es_la.mp4

# All languages (convenience npm scripts)
npm run render:en
npm run render:es_la
npm run render:fr
npm run render:pt_br

# Or all in sequence
npm run render:all
```

Each render:
- Calls `calculateMetadata` which reads `public/<lang>/captions.srt` for duration
- Passes `audioSrc`, `captions`, `durationSec`, and `language` to the `Main` composition
- Outputs a 1080×1920 (9:16) MP4 at 30fps

## How It Works — Architecture

### Two-Phase Pipeline

**Phase 1: Fetch** (`scripts/fetch-localization.mjs`)

The fetch script calls the SpeechLab REST API and writes assets to `public/<lang>/` so renders are deterministic and offline-capable:

```
POST /auth/login
  → tokens.accessToken.jwtToken

POST /projects/createProjectAndDub
  body: { projectName, sourceLanguage: 'en', targetLanguage: 'es_la', mediaUrl }
  → { projectId, jobId, dubStatus }          ← response is FLAT (not nested)

GET /projects  (poll every 10 s)
  → translations[0].dub[0].status            ← key is 'dub' (singular)
  terminal: status === 'COMPLETE'

GET /medias/getMediaPresignedURL?projectId=<id>
  → raw presigned URL string                 ← note plural 'medias' in path
```

**Phase 2: Render** (Remotion)

```
calculateMetadata({ props: { language } })
  → loadLocalization(language)               ← reads public/<lang>/captions.srt
  → { durationInFrames, props: { audioSrc, captions, ... } }

MainComposition({ language, audioSrc, captions, durationSec })
  → <Audio src={audioSrc} />                 ← dubbed voice
  → <CaptionOverlay pages={tikTokPages} />   ← translated captions, word-level highlight
```

### Key Files

| File | Responsibility |
|------|---------------|
| `src/speechlab.ts` | `loadLocalization(language)` — reads `public/<lang>/` at render time; comments map each step to a SpeechLab endpoint |
| `src/Root.tsx` | Zod schema, `calculateMetadata`, `<Composition>` registration |
| `src/Main.tsx` | Visual composition — identical geometry across all languages |
| `src/CaptionOverlay.tsx` | Active-word TikTok-style caption overlay; RTL-aware |
| `scripts/fetch-localization.mjs` | Phase 1 fetch: auth → dub → poll → download |

## TypeScript

```bash
npm run typecheck
# or
npx tsc --noEmit
```

## Adding More Languages

1. Add the locale code to `mainSchema` in `src/Main.tsx`:
   ```ts
   language: z.enum(["en", "es_la", "fr", "pt_br", "es_es"]),
   ```
2. Add a render script to `package.json` (optional)
3. Run `node scripts/fetch-localization.mjs es_es`

## Demo footage

The `Subtitled` composition needs a source video at `public/source.mp4`:

```bash
curl -L https://media.w3.org/2010/05/sintel/trailer_hd.mp4 -o public/source.mp4
```

Then render the real demo (real footage + SpeechLab dub + Remotion subtitles):

```bash
npx remotion render src/Root.tsx Subtitled --props='{"language":"es_la"}' --output=out/subtitled-es_la.mp4
```
