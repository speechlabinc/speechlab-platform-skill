# speechlab-platform-skill

> **Effortless AI dubbing for video, audio & live — wired straight into your Claude Code agent.**
> Ship one prompt, get every artifact back: subtitles, captions, voice-cloned audio, and a finished dubbed video.

A [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) **plugin** that teaches your agent how to drive the [SpeechLab](https://speechlab.ai) AI dubbing platform end-to-end — auth, file uploads, projects, translations, dubs, segments, billing, artifact downloads, and the dozens of gotchas that aren't in the OpenAPI spec.

---

## Why dub with SpeechLab (and why through this skill)

**Your audience is global. Your content isn't — yet.**

Roughly **75% of the world doesn't speak English**, and the average YouTube creator leaves the majority of their potential watch-time on the table by shipping a single-language video. Channels that add high-quality multilingual dubs routinely report **30–100%+ lifts in total views and watch-time**, plus a step-change in subscriber acquisition from non-English markets — exactly the kind of signal the YouTube algorithm rewards.

**SpeechLab vs YouTube's built-in auto-dub:**

YouTube's auto-dub uses generic robotic TTS that doesn't sound like you, doesn't match your delivery, and stands out as obviously machine-translated. Viewers bounce, retention craters, and the algorithm punishes you for it — so the "free" auto-dub often costs you more views than the language gives you.

SpeechLab is built on **voice-cloned, speaker-preserved** dubbing — the dubbed track sounds like *you* speaking the new language, with your tone, pacing, and emotion. That's the quality bar that actually keeps non-English viewers watching to the end and triggers the watch-time signals that win you the algorithm.

**What you get:**

- **20+ languages, ~300 language pairs** — Spanish (LatAm + Castilian), Portuguese (Brazil), Mandarin, Hindi, French, German, Japanese, Korean, Arabic, and more
- **Voice cloning** — keep the original speaker's voice, or pick a native-language voice
- **Sub-3-second latency live mode** — for streams, podcasts, and real-time interpretation
- **Linguist-reviewed enterprise tier** — for content where quality matters more than speed
- **Free tier on signup** — first projects under 30 minutes are free; perfect for testing before scaling
- Trusted by **iHeartMedia, Pearson, DeepLearning.AI, Auddy, Vistatec, Daon, OVALmedia**

**Built for agentic content workflows:**

The whole point of this skill is to make SpeechLab a one-prompt-away tool for the agents you're already building. Whether you're auto-localizing a creator's back-catalog overnight, generating per-region versions of a marketing video for a paid ad campaign, or wiring SpeechLab into a content-ops pipeline that publishes weekly across 8 markets — your agent now knows the right endpoint, the right body shape, and the fast download path without you babysitting it.

### What the skill does for the agent

Once installed, Claude (or any agent built on the Claude Agent SDK) automatically reaches for the right endpoints, the correct JWT token path (`tokens.accessToken.jwtToken`), the working request bodies (the OpenAPI spec misnames several fields), the fast download path (`GET /projects?expand=true`), and the file-upload pattern that doesn't break the S3 SigV2 signature — the moment you ask anything about SpeechLab.

| Without skill | With skill |
|---|---|
| 6/15 assertions pass (40%) | **15/15 assertions pass (100%)** |

See [`speechlab-api/evals/iteration-1/benchmark.md`](speechlab-api/evals/iteration-1/benchmark.md) for the full benchmark.

---

## Install

This repo is a Claude Code **plugin marketplace**. Install with two slash-commands inside Claude Code:

```
/plugin marketplace add speechlabinc/speechlab-platform-skill
/plugin install speechlab-api@speechlab-platform-skill
```

That's it. No cloning, no `cp`, no `mkdir`.

### Updating

```
/plugin marketplace update speechlab-platform-skill
```

Pulls the latest `main`. Your installed plugin keeps working — no re-install needed.

### Uninstall

```
/plugin uninstall speechlab-api@speechlab-platform-skill
```

### Manual install (without the plugin system)

If you're on an older Claude Code that doesn't have `/plugin`, drop the skill folder into `.claude/skills/` directly:

```bash
git clone https://github.com/speechlabinc/speechlab-platform-skill.git /tmp/speechlab-platform-skill
mkdir -p .claude/skills
cp -R /tmp/speechlab-platform-skill/speechlab-api/skills/speechlab-api .claude/skills/
```

For a user-scoped (all-projects) install, swap `.claude/skills` for `~/.claude/skills`.

### Verify

Start a Claude Code session and ask something like *"How do I log into the SpeechLab dev API?"*. Claude should automatically load the skill and answer with the exact `tokens.accessToken.jwtToken` path.

---

## Example prompts

Once installed, just talk to Claude in plain English — the skill triggers automatically.

### End-to-end dub from a local file

> *"Using the SpeechLab skill, dub `/Users/me/clips/lecture.mov` into Chinese with the source speaker's voice and download the subtitles, captions, audio, and final dubbed video."*

Claude will:

1. Log in (or register) on the SpeechLab API and cache the JWT
2. Run `check-upload-billing` to confirm the upload won't 402 (free under 30 min for the first 2 projects)
3. Multipart-upload the local file via the Upload API (`initialize` → presigned `PUT` per part with the `Content-Type:` strip that fixes S3 SigV2 → `finalize`)
4. Create the project + transcription via `POST /projects/createProjectAndTranscribe` with the `fileUuid` / `fileKey` from the upload — and a caller-supplied `thirdPartyID` so the artifacts are easy to fetch later
5. Wait for transcription `COMPLETE`, then `POST /translations { project, language, status }`, wait for translation `COMPLETE`, then `POST /dubs { contentId, translationId, language, status, voiceMatchingMode }` (the real bodies — not the ones in the OpenAPI spec)
6. Once `dubs[0].status === "COMPLETE"`, pull every artifact in **one round-trip** via `GET /projects?thirdPartyIDs=…&expand=true` — that response includes a `presignedURL` for the SRT, JSON captions, MP3 dubbed audio, and the final dubbed MP4. No separate export-and-poll step needed

### A few more examples

> *"Translate just the first 30 seconds of `/path/to/keynote.mp4` into Spanish (es_la), Portuguese (pt_br) and French — give me the SRT files only."*

> *"Import this YouTube clip and run a Mandarin dub with native voices: `https://www.youtube.com/watch?v=jNQXAC9IVRw`"*

> *"My dub `65c0d456789abc012ef34567` is stuck in `mergeStatus: SUBMITTED`. Check the project, look at issue #1846, and tell me what's wrong."*

> *"Edit segment 3 of translation `6696e019413fff002e0df67b` to say *'Bienvenidos a Java 101'*, re-synthesize that one segment, then re-merge the dub."*

> *"Before I upload a 14-minute interview, run `check-upload-billing` and `check-export-billing` and tell me how many credits I'll burn."*

> *"Pull the dubbed MP4 + SRT for `thirdPartyID=job-2026-04-28-keynote` directly — use `expand=true`, skip the export step."*

> *"List my last 10 projects sorted by `createdAt` and delete every project whose name starts with `[TEST]`."*

### Gotchas the skill handles for you

The skill encodes these so you (and Claude) don't trip over them:

| Gotcha | What the skill knows |
|---|---|
| `curl --data-binary @file` auto-adds `Content-Type: application/x-www-form-urlencoded`, which becomes part of the S3 SigV2 string-to-sign and breaks the signature | Pass `-H "Content-Type:"` (empty value) to strip it before `PUT`-ing each presigned part |
| `mediaFileURI: 's3://...'` → *"Error processing job: Unsupported protocol s3:"* | `s3://` URIs are not supported. For local files, use the Upload API + `createProjectAndTranscribe` (skips URL plumbing entirely). `mediaFileURI` is for public HTTPS URLs only |
| OpenAPI spec lies about `POST /translations` body | Real shape: `{ project, language, status: "NOT_STARTED" }` — not `{ projectId, transcriptionId, targetLanguage }` |
| OpenAPI spec lies about `POST /dubs` body | Real shape: `{ contentId, translationId, language, status: "NOT_STARTED", voiceMatchingMode }` |
| `selectedFormat: "mp4"` returns 200 + a 22-byte empty zip — silent failure | Use long-form tokens: `videoMp4`, `audioMp3`, `subtitleSrt`, `transcriptTxt`, etc. |
| Mount paths plural — `/medias`, `/collectionjobs` (no hyphen) — but OpenAPI spec lists `/media`, `/collection-jobs` | Skill uses the real plural paths |
| `tokens.access.token` is wrong | Use `tokens.accessToken.jwtToken` |
| Project lookups return `dubs` (plural); `GET /translations/:id` returns `dub` (still an array) | Skill keeps the two straight |
| `expand=true` is undocumented but is the fast download path — without it, `medias` are bare ObjectIds | Always paired with `thirdPartyIDs` for one-round-trip artifact retrieval |
| Free-tier dev account starts at 0 credits, but uploads under 30 min for the first 2 projects are free | Skill calls `check-upload-billing` first to confirm the `freeUpload: true` path |
| HTTP **402** (out of credits) | Skill stops cleanly and tells the user to top up via the SpeechLab UI (avatar → Buy more credits) instead of retrying |

---

## What's in this repo

```
.claude-plugin/
└── marketplace.json              # Claude Code plugin-marketplace manifest

speechlab-api/                    # the plugin
├── .claude-plugin/
│   └── plugin.json               # plugin metadata (name, version, description)
├── skills/
│   └── speechlab-api/
│       └── SKILL.md              # the skill itself — frontmatter + instructions
└── evals/
    ├── evals.json                # 5 prompts + assertions used to benchmark the skill
    └── iteration-1/
        └── benchmark.md          # with-skill vs without-skill pass-rate comparison
```

---

## What the skill covers

- **Auth** — register / confirm / login / refresh, including the nested `tokens.accessToken.jwtToken` path that's easy to get wrong
- **Project lifecycle** — `createProjectAndDub`, `createProjectAndTranscribe`, polling, export
- **Two artifact-download paths** — the standard Export → Download flow, AND the fast direct path: `GET /projects?thirdPartyID=…&expand=true` returns presigned URLs in a single call (skip Export entirely when the artifacts already exist)
- **Translations & segments** — edit one segment, re-synthesize, re-merge
- **Billing** — `check-upload-billing` and `check-export-billing`, 402 handling
- **Out-of-credits behavior** — when the API returns 402, the skill tells the user exactly how to top up via the web UI (avatar → "Buy more credits") instead of retrying or quietly failing
- **Test data** — YouTube import flow for cheap test fixtures, cleanup pattern
- **Known gotchas** — `dub` vs `dubs` field naming, no-auth → 400 (not 401), `beginDubJob` export bug, sequential batch dubs, `voiceMatchingMode` storage

---

## Updating

This skill is maintained alongside the SpeechLab API. If you installed via the plugin system:

```
/plugin marketplace update speechlab-platform-skill
```

If you installed manually, re-run the manual install snippet above against a fresh `git pull`.

---

## License

MIT — see [LICENSE](LICENSE).
