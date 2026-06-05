# speechlab-platform-skill

**One prompt. Every artifact. Any language.**

A [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skill that teaches your agent to drive the [SpeechLab](https://speechlab.ai) AI dubbing platform end-to-end — auth, multipart uploads, projects, transcription, translation, dubs, segment edits, billing checks, and artifact downloads. No babysitting, no gotcha-hunting. The skill knows the API as it actually behaves, not as the OpenAPI spec describes it.

> Benchmark: **15/15 assertions pass with the skill (100%)** vs 6/15 without it (40%).  
> See [`speechlab-api/evals/iteration-1/benchmark.md`](speechlab-api/evals/iteration-1/benchmark.md) for the full results.

---

## Why this exists

SpeechLab's REST API has a gap between its published OpenAPI spec and how the endpoints actually behave in production. Several request body shapes are wrong in the spec. The JWT path is nested differently than every other Cognito-shaped API. The fast artifact-download path is entirely undocumented. The export endpoint silently produces a valid-looking empty zip when you pass the wrong format token.

Without this skill, an agent reading the spec cold gets 40% of tasks right. With it, the hit rate is 100% because the skill encodes what the spec omits.

---

## Install

### Option 1 — Claude Code plugin marketplace (recommended)

Run these two slash-commands inside any Claude Code session:

```
/plugin marketplace add speechlabinc/speechlab-platform-skill
/plugin install speechlab-api@speechlab-platform-skill
```

No cloning, no file copies, no restart needed. Updates pull cleanly:

```
/plugin marketplace update speechlab-platform-skill
```

To remove:

```
/plugin uninstall speechlab-api@speechlab-platform-skill
```

### Option 2 — Manual git clone into `.claude/skills/`

Use this path if you are on an older Claude Code build that does not have `/plugin`, or if you want to pin a specific commit.

```bash
git clone https://github.com/speechlabinc/speechlab-platform-skill.git /tmp/speechlab-platform-skill
mkdir -p .claude/skills
cp -R /tmp/speechlab-platform-skill/speechlab-api/skills/speechlab-api .claude/skills/
```

For a user-scoped install that activates across all projects on your machine, target `~/.claude/skills/` instead:

```bash
mkdir -p ~/.claude/skills
cp -R /tmp/speechlab-platform-skill/speechlab-api/skills/speechlab-api ~/.claude/skills/
```

To update a manually-installed skill, re-run the clone-and-copy steps against a fresh pull.

### Verify the install

Open a Claude Code session and ask:

> *"How do I log into the SpeechLab API?"*

Claude should immediately load the skill and respond with the exact `tokens.accessToken.jwtToken` extraction path — not a guess, not `tokens.access.token`.

---

## Trigger phrases

The skill activates automatically when your prompt contains any of these:

- `speechlab API`
- `create a dub`
- `dub pipeline`
- `POST /dubs/merge`
- `translation segments`
- `check-upload-billing`
- `check-export-billing`
- `import youtube` / `import-youtube`
- `createProjectAndDub`
- `createProjectAndTranscribe`
- `beginDubJob`
- `voiceMatchingMode`
- `mergeStatus`
- Any question about SpeechLab endpoints, JWT auth, or the dubbing pipeline

You can also open any conversation with *"Using the SpeechLab skill, ..."* to load it explicitly.

---

## Example prompts

### Dub a local file end-to-end

> *"Using the SpeechLab skill, dub `/Users/me/clips/lecture.mov` into Mandarin with voice cloning, and download the SRT, JSON captions, MP3 audio, and final dubbed video."*

The agent will: log in, call `check-upload-billing` to confirm free-tier eligibility, multipart-upload the file with the S3 SigV2 fix applied, create the project via `createProjectAndTranscribe`, poll transcription to COMPLETE, post a translation with the correct body shape, post a dub, poll `GET /projects` until `translations[0].dub[0].status` is `COMPLETE`, watch `mergeStatus` for merge completion, then pull all artifacts via `GET /medias/getMediaPresignedURL`.

### Dub a public URL into multiple languages

> *"Dub `https://cdn.example.com/keynote.mp4` into Spanish (es_la), Portuguese (pt_br), and French (fr) using native voices. Give me the SRT files only."*

### Import a YouTube clip and dub it

> *"Import `https://www.youtube.com/watch?v=jNQXAC9IVRw` and run a Spanish dub with source voice cloning."*

### Debug a stuck dub

> *"My dub `65c0d456789abc012ef34567` is stuck on `mergeStatus: SUBMITTED`. Check the project and tell me what's wrong."*

The skill knows about issue #1846 — `beginDubJob` missing from `module.exports` in `dub.service.js` — and will surface it before listing generic 502 causes.

### Edit a segment and re-merge

> *"Edit segment 3 of translation `6696e019413fff002e0df67b` to read 'Bienvenidos a Java 101', re-synthesize just that segment, then re-merge the full dub."*

### Check credits before a large upload

> *"Before I upload a 45-minute interview, run `check-upload-billing` and `check-export-billing` and tell me exactly how many credits I'll use."*

### Fast artifact pull by correlation ID

> *"Pull the dubbed MP4 and SRT for `thirdPartyID=job-2026-04-28-keynote` — skip the export step."*

Use `GET /medias/getMediaPresignedURL?projectId=<id>` for a presigned URL, or `POST /medias/getMediaPresignedURL { fileKey }` for a specific file. Note that `expand=true` on `GET /projects` does NOT presign — it populates metadata only.

---

## What the skill covers

| Area | Details |
|---|---|
| **Auth** | Register, confirm email, login, refresh. Exact `tokens.accessToken.jwtToken` path. Missing-auth → 400 (not 401) behavior. Base URL: `https://translate-api.speechlab.ai/v1`. |
| **File uploads** | Multipart initialize → presigned PUT (with SigV2 `Content-Type:` strip) → finalize. YouTube import as a no-upload shortcut. |
| **Project lifecycle** | `createProjectAndDub` (public HTTPS source) returns flat `{ projectId, jobId, dubStatus }`. `createProjectAndTranscribe` (Upload API source). Poll status via `GET /projects`, not `GET /projects/{id}`. |
| **Translations & dubs** | Correct POST body shapes for `/translations` and `/dubs` — both differ from what the OpenAPI spec documents. Language codes use underscore enum format (`es_la`, `pt_br`, `fr_ca`). Bare codes like `es` return HTTP 400. |
| **Polling** | Terminal success = `COMPLETE` on `translations[0].dub[0].status` (field is `dub` singular) via `GET /projects`. Watch `mergeStatus` for merge completion. |
| **Segments** | Edit one segment, re-synthesize, re-merge. `isMerge` logic and sequential batch dub behavior. |
| **Artifact downloads** | Presigned URL via `GET /medias/getMediaPresignedURL?projectId=<req>&mediaId=<opt>` (returns raw URL string) or `POST /medias/getMediaPresignedURL { fileKey }` (returns `{ presignedUrl }`). Standard path: `exportProject` + `collectionjobs` polling + download. |
| **Billing** | `check-upload-billing` and `check-export-billing`. Free-tier eligibility check. 402 handling (see Troubleshooting). |
| **Known API bugs** | `beginDubJob` (#1846), empty-zip export, plural mount paths, `dub` vs `dubs` field inconsistency. |

---

## Troubleshooting

### JWT path returns `undefined`

**Symptom:** `res.data.tokens.access.token` or `res.data.token` is `undefined` after login.

**Fix:** The Cognito token response is nested differently than most APIs. The correct path is:

```js
const token = res.data.tokens.accessToken.jwtToken;
```

Not `tokens.access.token`, not `tokens.token`, not `data.token`. The skill pins this path explicitly so Claude doesn't guess.

---

### `dub` vs `dubs` — wrong field name

**Symptom:** Iterating over `translation.dubs` returns `undefined`.

**Explanation:** The field name is `dub` (singular) in all polling contexts. The correct path when checking via `GET /projects` is `translations[0].dub[0].status`. Using `dubs` (plural) returns `undefined`.

This is a known inconsistency in the API. The skill always uses the correct singular field name.

---

### `GET /projects/{id}` does not show dub status

**Symptom:** Polling `GET /projects/{projectId}` and the dub status is missing or always shows the same value.

**Fix:** The single-project endpoint does not populate dub. Use `GET /projects` (list endpoint) and read `translations[0].dub[0].status`. For merge state, use `GET /dubs/{dubId}` and check `mergeStatus`.

---

### Dub stuck on `mergeStatus: SUBMITTED`

**Symptom:** A dub completes synthesis (`status: COMPLETE`) but `mergeStatus` stays `SUBMITTED` or `PROCESSING` indefinitely. `POST /dubs/merge` returns 502.

**Root cause:** Issue #1846 — `beginDubJob` is not included in `module.exports` of `dub.service.js`. The merge controller imports it via destructuring, gets `undefined`, and calling it throws a `TypeError` that surfaces as a 502.

**Fix:** Add `beginDubJob` to `module.exports` in `dub.service.js`.

When you ask Claude about a stuck `mergeStatus`, the skill surfaces this specific cause first rather than listing generic 502 possibilities.

---

### HTTP 402 — out of credits

**Symptom:** `check-upload-billing`, `check-export-billing`, or any pipeline call returns HTTP 402.

**What to do:** There is no API endpoint for purchasing credits. Do not retry or work around the 402. The agent will stop cleanly and tell you:

> Open [https://translate.speechlab.ai](https://translate.speechlab.ai), click your avatar in the top-right corner, and select **Buy more credits**. Your existing JWT keeps working after you top up — just re-issue the same request.

The skill identifies which pipeline step hit the credit limit (upload, dub, or export) so you know exactly what credits you need.

---

### `selectedFormat: "mp4"` produces an empty zip

**Symptom:** `exportProject` completes successfully and returns a download URL, but the zip file is 22 bytes and contains nothing.

**Fix:** `selectedFormat` requires long-form format tokens. Short names like `mp4`, `srt`, `wav`, `txt` are silently accepted but produce empty output. Use:

| Content | Token |
|---|---|
| Dubbed video | `videoMp4` |
| Dubbed audio | `audioMp3` |
| Subtitles | `subtitleSrt` |
| Transcript | `transcriptTxt` |

Alternatively, skip `exportProject` entirely and use `GET /medias/getMediaPresignedURL?projectId=<id>` to get a presigned URL for artifacts that already exist.

---

### Language code returns HTTP 400

**Symptom:** `createProjectAndDub` returns HTTP 400 with a validation error.

**Fix:** The API requires locale-specific underscore codes from a fixed enum. Use `es_la` (not `es`), `pt_br` (not `pt` or `pt-BR`), `fr_ca` (not `fr-CA`). The accepted values include: `es_la`, `es_es`, `fr`, `fr_ca`, `pt_pt`, `pt_br`, `ar_sa`. Call `GET /languages` to get the full current list.

---

## Companion resources

- **speechlab-mcp** — MCP server that exposes the full SpeechLab platform as structured tools for Claude Desktop, Claude Code, and any MCP-compatible client. No curl, no SDK — just ask Claude. Install with one command:

  ```bash
  claude mcp add speechlab npx speechlab-mcp \
    -e SPEECHLAB_EMAIL=you@example.com \
    -e SPEECHLAB_PASSWORD=yourpassword \
    -e SPEECHLAB_API_URL=https://translate-api.speechlab.ai/v1
  ```

  Or add manually to `claude_desktop_config.json`:

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

  Repository: [github.com/speechlabinc/speechlab-mcp](https://github.com/speechlabinc/speechlab-mcp)

- **Remotion globalization example** — End-to-end example combining SpeechLab dubbing with a Remotion video composition. Scaffold with `npx create-video@latest --yes --blank --no-tailwind <name>`, render with `npx remotion render`, parametrize compositions via Zod schema + `calculateMetadata`, add audio via `<Audio>` from `@remotion/media`, and burn captions via `@remotion/captions`. See [`examples/remotion-globalization`](examples/remotion-globalization) in this repository.

- **SpeechLab platform** — [translate.speechlab.ai](https://translate.speechlab.ai) — where you manage credits, review projects, and access the web UI.

- **API reference** — `https://translate-api.speechlab.ai/v1/docs` (Swagger UI). Append `/docs.json` for the raw OpenAPI JSON. Note that several endpoint descriptions and request body shapes in the spec differ from actual behavior; the skill's SKILL.md documents all known divergences.

---

## Repository layout

```
.claude-plugin/
└── marketplace.json          # Claude Code plugin marketplace manifest

speechlab-api/                # the installed plugin
├── .claude-plugin/
│   └── plugin.json           # plugin metadata (name, version, description)
├── skills/
│   └── speechlab-api/
│       └── SKILL.md          # skill frontmatter + instructions read by Claude
└── evals/
    ├── evals.json             # 5 prompts + assertions used to benchmark the skill
    └── iteration-1/
        └── benchmark.md       # with-skill vs without-skill pass-rate results
```

---

## License

MIT — see [LICENSE](LICENSE).
