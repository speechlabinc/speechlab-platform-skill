---
name: speechlab-api
description: >
  SpeechLab AI dubbing platform API guide for agents and developers.
  Use this skill whenever working with the SpeechLab API — creating projects,
  managing dubs, editing segments, checking billing, setting up test data, or
  integrating the dubbing pipeline into applications or Playwright tests.
  Trigger on: "speechlab API", "create a dub", "POST /dubs/merge", "dub pipeline",
  "translation segments", "check-upload-billing", "import youtube", "createProjectAndDub",
  "beginDubJob", or any question about SpeechLab API endpoints, auth tokens, JWT,
  voiceMatchingMode, or the SpeechLab dubbing pipeline.
---

# SpeechLab API — AI Agent Skill

Use this skill whenever working with the SpeechLab API: creating projects,
managing dubs, checking billing, debugging errors, or setting up test data.

---

## Onboarding: Get an Account

### New users — sign up at https://translate.speechlab.ai

```
1. Click "Sign up" → enter name, email, password (min 8 chars, 1 letter + 1 number)
2. Check email for a 6-digit confirmation code
3. POST /auth/register/confirmation  { email, confirmationCode }
4. POST /auth/login  { email, password }  → tokens.accessToken.jwtToken
```

Registration via API:
```js
// Step 1: register
await axios.post(`${BASE}/auth/register`, {
  name: 'Your Name',
  email: 'you@example.com',
  password: 'Password123!',
  industry: 'Media',
  productInterest: 'dub',
});

// Step 2: confirm (code arrives by email)
await axios.post(`${BASE}/auth/register/confirmation`, {
  email: 'you@example.com',
  confirmationCode: '123456',
});

// Step 3: login → get JWT
const res = await axios.post(`${BASE}/auth/login`, {
  email: 'you@example.com',
  password: 'Password123!',
});
const token = res.data.tokens.accessToken.jwtToken; // use this everywhere
```

### Dev / staging API

Use the dev base URL `https://api-translate-dev.speechlab.ai/v1` for testing.
Create a personal account via `/auth/register` (see flow above) — do not share
credentials in code or commits.

---

## Base URLs

| Environment | URL |
|---|---|
| Local dev | `http://localhost:80/v1` |
| Dev / staging | `https://api-translate-dev.speechlab.ai/v1` |
| Production | `https://translate-api.speechlab.ai/v1` |
| Swagger UI | `http://localhost/v1/docs/` (local) · `{base}/docs` (remote) |
| OpenAPI JSON | `{base}/docs.json` |

---

## Authentication

```js
const res = await axios.post(`${BASE}/auth/login`, { email, password });

// The JWT is nested — NOT tokens.access.token
const token = res.data.tokens.accessToken.jwtToken;

// Add to every request
const headers = { Authorization: `Bearer ${token}` };
```

**Gotcha**: Missing Authorization header → HTTP **400** (not 401).  
**Gotcha**: Invalid/expired token → HTTP **401**.  
**Refresh**: `POST /auth/refresh-tokens` with `{ refreshToken: tokens.refreshToken.token }`.

---

## Key Concepts

| Concept | What it is |
|---|---|
| **Project** | Container for one media file. Has content, transcription, translations[], each with dubs[] |
| **Content** | Raw media metadata — fileUuid, contentDuration, language |
| **Transcription** | ASR output with time-aligned segments (startTime/endTime/speaker/content) |
| **Translation** | Translated text for a target language. Field named `dub` (array) on GET /translations/:id |
| **Dub** | Synthesized audio. Has `language`, `voiceMatchingMode`, `status`, `mergeStatus` |
| **Segment** | Time-aligned text unit. `fileNameToDubs` map controls merge vs re-synthesis |
| **`thirdPartyID`** | Caller-supplied correlation ID. **Strongly recommended** — set it at create time on `createProjectAndDub` / `createProjectAndTranscribe` so you can later retrieve the project (and pre-signed download URLs for every artifact) via `GET /projects?thirdPartyIDs=…&expand=true`. |

### voiceMatchingMode
- `source` — clone the source speaker's voice  
- `native` — use a language-native TTS voice  
- `customized` — per-speaker config in `customizedVoiceMatchingSpeakers`  

All dubs are stored internally as `customized` regardless of the requested mode.

### Status Lifecycle
```
NOT_STARTED → SUBMITTED → GENERATING → PROCESSING → COMPLETE
                                                   ↘ ERROR
```
Both `status` (synthesis) and `mergeStatus` (audio merge) follow this lifecycle.

---

## Two Source Paths — pick the right one

The single most common mistake when wiring SpeechLab into a new app is
mismatching the *source-file path* with the *project-creation endpoint*.
There are exactly two supported source-file paths:

### Path 1 — Upload API (any local file)

Use this whenever the user has a file on their machine. Three steps:

```
POST /uploads/initialize-multipart-upload  { name }
   → { fileUuid, fileKey, fileId }
POST /uploads/get-multipart-preSigned-urls { fileKey, fileId, parts: <n> }
   → { parts: [{ PartNumber, signedUrl }] }
PUT  <signedUrl>  --data-binary @<chunk>   -H "Content-Type:"
   → ETag (capture from response header)
POST /uploads/finalize-multipart-upload    { fileKey, fileId, parts: [{ PartNumber, ETag }] }
```

Then pair with **`createProjectAndTranscribe`** (NOT `createProjectAndDub`) —
it accepts `fileUuid` + `fileKey` directly, no public URL needed.

**Gotcha — S3 SigV2 + `curl --data-binary`**: curl auto-adds
`Content-Type: application/x-www-form-urlencoded`, which becomes part of the
SigV2 string-to-sign. The presigned URL was generated with no Content-Type,
so the signature mismatches and S3 returns `403 SignatureDoesNotMatch`. Pass
`-H "Content-Type:"` (empty value) to strip the header.

### Path 2 — Public HTTPS URL (file already on the web)

Use `POST /projects/createProjectAndDub` with `mediaFileURI` set to a
public HTTPS URL the backend can reach (CDN, public bucket, signed URL valid
for the dub duration).

> **`s3://` URIs are NOT supported.** The dub worker rejects them with
> *"Error processing job: Unsupported protocol s3:"*. You must use
> `https://`. If you only have an internal S3 object, either upload it
> through Path 1 instead, or copy it somewhere with a public HTTPS URL.

### Decision table

| Source | Endpoint | Why |
|---|---|---|
| Local file on the user's disk | Upload API → `createProjectAndTranscribe` | Skip URL plumbing entirely |
| Already a public CDN/HTTPS URL | `createProjectAndDub` with `mediaFileURI` | One-shot pipeline |
| YouTube link | `/uploads/import-youtube` → `createProjectAndTranscribe` | YouTube import returns the same `fileUuid` shape |
| File already in our internal S3 (`s3://...`) | **Cannot use directly** — convert to HTTPS or re-upload | `s3://` is unsupported |

---

## Complete Workflow Recipes

### Recipe A: Full Dub Pipeline (single call, public HTTPS source)

For files that already live behind a public HTTPS URL — `createProjectAndDub`
runs the entire transcribe → translate → dub pipeline in one shot. **Never
use this with `s3://`** — the worker rejects it. For local files, use
Recipe A2 below.

```js
const { tokens } = (await axios.post(`${BASE}/auth/login`, { email, password })).data;
const token = tokens.accessToken.jwtToken;
const headers = { Authorization: `Bearer ${token}` };

const { data } = await axios.post(`${BASE}/projects/createProjectAndDub`, {
  name: 'My Video',
  sourceLanguage: 'en',
  targetLanguage: 'es_la',
  dubAccent: 'es_la',
  mediaFileURI: 'https://cdn.example.com/uploads/video.mp4', // HTTPS only
  voiceMatchingMode: 'source',
  thirdPartyID: 'job-2026-04-28-keynote', // ← set this so you can fetch artifacts later via expand=true
  unitType: 'unit',
  isAudioOnlyFile: false,
}, { headers });

const projectId = data.project._id;

// Poll every 5s until dub is COMPLETE
let dub;
while (true) {
  const project = (await axios.get(`${BASE}/projects/${projectId}`, { headers })).data;
  dub = project.translations?.[0]?.dubs?.[0];
  if (dub?.status === 'COMPLETE') break;
  if (dub?.status === 'ERROR') throw new Error('Dub failed');
  await new Promise(r => setTimeout(r, 5000));
}

// Skip the explicit Export step — Recipe E pulls every artifact in one call
```

### Recipe A2: Full Dub Pipeline (local file, manual stages)

`createProjectAndDub` doesn't support `s3://` or non-public URLs, so for
locally-sourced files the working pattern is: **upload → transcribe →
translate → dub**, with status polling between each stage. The
`thirdPartyID` keeps the project easy to look up later.

```js
// 0. Multipart upload (returns fileUuid + fileKey)
const { fileUuid, fileKey, fileId } = (await axios.post(
  `${BASE}/uploads/initialize-multipart-upload`,
  { name: 'lecture.mov' }, { headers }
)).data;
// ... split file, fetch signed URLs, PUT each part with `-H "Content-Type:"`,
//     finalize-multipart-upload with the array of {PartNumber, ETag}.

// 1. Create project + transcription in one call
const { data: created } = await axios.post(`${BASE}/projects/createProjectAndTranscribe`, {
  name: 'My Lecture',
  language: 'en',
  fileUuid, fileKey,
  filenameToReturn: 'lecture.mov',
  contentDuration: 17.5,
  thirdPartyID: 'job-2026-04-28-lecture',
  unitType: 'unit',
}, { headers });
const projectId = created.project.id;
const contentId = created.project.content.id;
const transcriptionId = created.project.transcription.id;

// 2. Wait for transcription COMPLETE, then create translation
//    (Real shape — NOT the OpenAPI's projectId/transcriptionId/targetLanguage)
const tx = (await axios.post(`${BASE}/translations`, {
  project: projectId,
  language: 'zh',
  status: 'NOT_STARTED',
}, { headers })).data;
const translationId = tx.translation.id;

// 3. Wait for translation COMPLETE, then create dub
//    (Real shape — NOT the OpenAPI's projectId/translationId/targetLanguage/voiceId)
const dub = (await axios.post(`${BASE}/dubs`, {
  contentId,
  translationId,
  language: 'zh',
  status: 'NOT_STARTED',
  voiceMatchingMode: 'source',
}, { headers })).data;
const dubId = dub.id;

// 4. Poll dub until COMPLETE, then download via Recipe E
```

### Recipe B: Test Project (YouTube, no file upload)

```js
// Great for integration tests and Playwright test setup
const headers = { Authorization: `Bearer ${token}` };

// Import "Me at the zoo" — 19s, public domain, reliably available
const { data: imp } = await axios.post(`${BASE}/uploads/import-youtube`,
  { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }, { headers });
const fileUuid = imp.fileUuid || imp.uuid;

const { data } = await axios.post(`${BASE}/projects/createProjectAndTranscribe`, {
  name: `[TEST] ${Date.now()}`,
  language: 'en',
  fileUuid, fileKey: fileUuid,
  filenameToReturn: 'test.mp4',
  contentDuration: 19, unitType: 'unit',
}, { headers });

const projectId = data._id || data.project?._id;

// Always clean up
await axios.patch(`${BASE}/projects/${projectId}`, { isDeleted: true }, { headers });
```

### Recipe C: Edit Segment + Re-merge

```js
const t = (await axios.get(`${BASE}/translations/${translationId}`, { headers })).data;
const seg = t.translationSegments[0];

// Edit text
await axios.patch(`${BASE}/translations/${translationId}/segments/${seg._id}`,
  { content: 'New translated text' }, { headers });

// Re-synthesize → get presigned audio URL
const { data: synth } = await axios.post(`${BASE}/dubs/synthesize`, {
  contentId, translationId, dubId,
  segment: { speaker: seg.speaker, start_time: seg.startTime,
              end_time: seg.endTime, text: 'New translated text' },
}, { headers });
// synth.url = presigned S3 URL valid for 1 hour

// Merge all segments → final audio
await axios.post(`${BASE}/dubs/merge`, {
  contentId, translationId, dubId, segmentLevel: false,
}, { headers });
// Response: updated dub with mergeStatus: "SUBMITTED"
```

### Recipe D: Check Credits

```js
// Before upload (duration in seconds)
const up = await axios.post(`${BASE}/dubs/check-upload-billing`, {
  uploads: [{ duration: 120, filename: 'video.mp4' }],
}, { headers });
// 200: { success, uploads: [{ requiredCredits, duration, filename }] }
// 402: insufficient credits

// Before export
const ex = await axios.post(`${BASE}/dubs/check-export-billing`, {
  contentId, translationId, dubId,
}, { headers });
// 200: { success, availableCredits, requiredCredits } or { invoiceBilling: true }
// 402: payment required
```

### Recipe E: Direct artifact download via `GET /projects?expand=true` (preferred)

`GET /projects?thirdPartyIDs=<id>&expand=true` returns the project plus
**pre-signed download URLs for every artifact already on the project** in a
single response — no `exportProject` call, no polling, no separate download
job. This is the **primary download path** the skill recommends. Set
`thirdPartyID` at project-create time so the lookup is trivial.

```js
// One call → presigned URLs for every existing artifact
const { data } = await axios.get(`${BASE}/projects`, {
  params: { thirdPartyIDs: 'job-2026-04-28-keynote', expand: true },
  headers,
});

const project = data.results[0];
for (const tx of project.translations ?? []) {
  // tx.medias = subtitle SRT, JSON captions, etc.
  for (const m of tx.medias ?? []) {
    if (!m.presignedURL) continue;
    const r = await axios.get(m.presignedURL, { responseType: 'stream' });
    r.data.pipe(fs.createWriteStream(`./out/translation.${m.format}`));
  }
  // tx.dub[*].medias = dubbed mp3, dubbed mp4, etc.
  for (const dub of tx.dub ?? []) {
    for (const m of dub.medias ?? []) {
      if (!m.presignedURL) continue;
      const r = await axios.get(m.presignedURL, { responseType: 'stream' });
      r.data.pipe(fs.createWriteStream(`./out/dub.${m.format}`));
    }
  }
}
```

**Forgot to set `thirdPartyID`?** Fall back to the project ID:
`GET /projects/:projectId?expand=true` returns the same shape.

#### Two download paths — which to use

| Goal | Use |
|---|---|
| Pull artifacts that already exist (subs, audio, dubbed video) | **`GET /projects?thirdPartyIDs=…&expand=true`** — one round-trip, presigned URLs included |
| Generate a new format that doesn't exist yet (e.g., re-export with `enable_wcag_bg_norm`) | `POST /projects/exportProject/:projectId` + poll `GET /collectionjobs` + download |
| Pull a single artifact by S3 key | `POST /medias/getMediaPresignedURL` body `{ fileKey }` |

**Gotchas with the Export path**:
- `selectedFormat` must use long-form tokens: `videoMp4`, `audioMp3`,
  `subtitleSrt`, `transcriptTxt`, etc. **Shorthand values like `mp4`,
  `srt`, `wav`, `txt` don't error** — they produce a successful
  `COMPLETED` job whose downloadUrl is a 22-byte empty zip. Always use
  long-form.
- The path is `/collectionjobs` (no hyphen), not `/collection-jobs`. The
  OpenAPI spec is wrong on this.
- Each collection-job item already has a `presignedUrl` field on it —
  no need to re-sign manually.
- The `/medias` route (plural) is at `POST /medias/getMediaPresignedURL`,
  not `/media/...`. The OpenAPI spec is wrong here too.

**Gotcha**: `expand=true` is what triggers the presign — without it, the
`medias` arrays contain bare ObjectId strings you can't download from.
Always pass it explicitly.

---

## Key API Endpoints Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Register new account |
| POST | `/auth/register/confirmation` | ❌ | Confirm email with 6-digit code |
| POST | `/auth/login` | ❌ | Login → `tokens.accessToken.jwtToken` |
| POST | `/auth/refresh-tokens` | ❌ | Refresh access token |
| POST | `/auth/logout` | ✅ | Invalidate session |
| GET | `/projects` | ✅ | List projects (`?limit=10&sortBy=createdAt:desc`) |
| GET | `/projects?thirdPartyIDs=<id>&expand=true` | ✅ | **Fast download path** — by correlation ID, with presigned URLs on every media (see Recipe E) |
| GET | `/projects/:projectId?expand=true` | ✅ | Same shape as above by internal `_id` |
| GET | `/projects/:projectId` | ✅ | Full project with translations + dubs populated |
| PATCH | `/projects/:projectId` | ✅ | Update name, isDeleted, etc. (NOT thirdPartyID — set at create time) |
| POST | `/projects/createProjectAndDub` | ✅ | Create project + full pipeline (HTTPS source URL only) |
| POST | `/projects/createProjectAndTranscribe` | ✅ | Create project + transcription, accepts Upload-API `fileUuid`/`fileKey` |
| POST | `/projects/exportProject/:projectId` | ✅ | Generate a NEW format (use `videoMp4`, `audioMp3`, etc. — not `mp4`) |
| GET | `/collectionjobs?sortBy=createdAt:desc` | ✅ | Poll export jobs — each result has a `presignedUrl` field (real path is no-hyphen) |
| POST | `/medias/getMediaPresignedURL` | ✅ | POST with `{fileKey}` to sign any S3 key in your org bucket |
| GET | `/translations/:translationId` | ✅ | Translation with segments + `dub` array |
| PATCH | `/translations/:translationId/segments/:segmentId` | ✅ | Edit one segment |
| POST | `/translations/:translationId/uploadCSV/:accent` | ✅ | Bulk update via CSV |
| GET | `/translations/:translationId/export/csv` | ✅ | Download segments as CSV |
| GET | `/dubs/:dubId` | ✅ | Dub with status + medias |
| PATCH | `/dubs/:dubId` | ✅ | Update dub fields |
| POST | `/dubs/merge` | ✅ | Merge segments → final audio (fix #1846) |
| POST | `/dubs/synthesize` | ✅ | Synthesize one segment → presigned URL |
| POST | `/dubs/check-upload-billing` | ✅ | Credits check before upload |
| POST | `/dubs/check-export-billing` | ✅ | Credits check before export |
| POST | `/uploads/import-youtube` | ✅ | Import YouTube → fileUuid |
| POST | `/uploads/initialize-multipart-upload` | ✅ | Start S3 multipart upload |
| POST | `/uploads/get-multipart-preSigned-urls` | ✅ | Get S3 signed URLs |
| POST | `/uploads/finalize-multipart-upload` | ✅ | Finalize multipart upload |
| GET | `/users/:userId/balance` | ✅ | Credit balance |

---

## Error Codes

| Code | Meaning | Common cause |
|---|---|---|
| 400 | Bad request / missing auth | Validation error or no `Authorization` header |
| 401 | Unauthorized | Invalid or expired JWT |
| 402 | Payment required | Insufficient credits — **see "Out of Credits" below** |
| 403 | Forbidden | Missing role/permission |
| 404 | Not found | Wrong ID or deleted resource |
| 409 | Conflict | Dub already exists for this language |
| 502 | Bad Gateway | ML API error, or `beginDubJob` not exported (#1846) |
| 500 | Server error | Check server logs |

### Out of Credits (HTTP 402 — required action)

When the API returns **HTTP 402**, or when `check-upload-billing` /
`check-export-billing` reports `requiredCredits > availableCredits`, the
user is out of credits. **Do not retry, work around, or attempt to top up
programmatically — there is no API endpoint for purchasing credits.**

The agent's job here is to clearly tell the user how to top up:

> *"You're out of SpeechLab credits. Open the SpeechLab translate UI at
> <https://translate.speechlab.ai>, click your avatar in the top-right
> corner, and choose **Buy more credits** in the dropdown. Once the
> balance refreshes, retry the request."*

The dropdown shows the user's current plan tier (Pre-paid, etc.) under
their name. After they top up, your existing JWT keeps working — just
re-issue the same request.

If the agent is in the middle of a longer pipeline (upload → dub →
export), it should **stop on the 402** rather than continue and produce
half a result. State exactly which step hit the credit limit
(`upload`, `dub`, `export`) so the user knows what they need credits for.

---

## Test Data Helpers

```js
// Reusable axios client + test project helpers — drop into your own tests/utils
const axios = require('axios');

const BASE = process.env.SPEECHLAB_API_BASE || 'https://api-translate-dev.speechlab.ai/v1';

async function login(email = process.env.SPEECHLAB_EMAIL, password = process.env.SPEECHLAB_PASSWORD) {
  const { data } = await axios.post(`${BASE}/auth/login`, { email, password });
  return data.tokens.accessToken.jwtToken;
}

async function authedClient() {
  const token = await login();
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function createTestProject(client, name = `[TEST] ${Date.now()}`) {
  const imp = await client.post('/uploads/import-youtube',
    { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' });
  const fileUuid = imp.data.fileUuid || imp.data.uuid;
  const proj = await client.post('/projects/createProjectAndTranscribe', {
    name, language: 'en', fileUuid, fileKey: fileUuid,
    filenameToReturn: 'test.mp4', contentDuration: 19, unitType: 'unit',
  });
  return proj.data._id || proj.data.project?._id;
}

async function deleteTestProject(client, projectId) {
  await client.patch(`/projects/${projectId}`, { isDeleted: true });
}
```

---

## Known Gotchas

| Issue | Detail |
|---|---|
| Token path | `tokens.accessToken.jwtToken` — **not** `tokens.access.token` |
| No-auth = 400 | Dev API returns 400 (not 401) when `Authorization` header is absent |
| `s3://` rejected | `mediaFileURI` must be `https://`. Internal S3 URIs error with *"Unsupported protocol s3:"* — use the Upload API + `createProjectAndTranscribe` instead |
| Mount paths plural | Real routes are `/medias/...` and `/collectionjobs` (no hyphen). The OpenAPI spec lists `/media/...` and `/collection-jobs` — both wrong |
| `selectedFormat` silent fail | Shorthand values (`mp4`, `srt`, `wav`, `txt`) get a `COMPLETED` job back but the resulting zip is a 22-byte empty `PK\0\0...` archive. Use the long-form tokens: `videoMp4`, `audioMp3`, `subtitleSrt`, `transcriptTxt`, ... |
| `POST /translations` shape | Body is `{project, language, status: "NOT_STARTED"}` — NOT `{projectId, transcriptionId, targetLanguage}` like the OpenAPI spec says |
| `POST /dubs` shape | Body is `{contentId, translationId, language, status: "NOT_STARTED", voiceMatchingMode}` — NOT `{projectId, translationId, targetLanguage, voiceId}` |
| `expand=true` not in spec | `GET /projects?thirdPartyIDs=…&expand=true` is the fast download path — returns a `presignedURL` on every media. Without `expand`, media are bare ObjectId strings |
| `/medias/getMediaPresignedURL` GET vs POST | GET expects `?projectId=…` + permission check on a media record. POST takes `{fileKey}` in the body and signs any S3 key in the org's bucket. Different semantics, undocumented |
| `thirdPartyID` is create-only | Can't be PATCHed in. Set it at create time on `createProjectAndDub` / `createProjectAndTranscribe` or you can't use the fast lookup later |
| `dub` vs `dubs` | `GET /translations/:id` returns `dub` (array). Projects endpoint returns `dubs` |
| `check-export-billing` ≠ `exportProject` gate | A 402 from `check-export-billing` does NOT prevent `exportProject` from accepting the job — it just means you'll burn credits or produce something the API later refuses. Always check first |
| Soft-delete | `PATCH /projects/:id {isDeleted: true}` hides projects from `GET /projects` listings (the records still exist; fetch by ID still works) |
| #1846 — 502 on merge | `beginDubJob` must be in `module.exports` of `dub.service.js` |
| isMerge logic | All `fileNameToDubs[dubKey]` non-empty → fast merge; any empty → full re-synthesis |
| Sequential batch dubs | `POST /dubs/multiple` runs sequentially to avoid isMerge race condition (#1698) |
| `isOver30Minutes` | Only in `check-upload-billing` response on the paid/credit-check path |
| voiceMatchingMode | All dubs stored as `customized` internally; per-speaker config controls actual mode |
| S3 SigV2 + curl | `curl --data-binary @file` adds `Content-Type: application/x-www-form-urlencoded`, breaking the SigV2 signature on presigned PUTs. Pass `-H "Content-Type:"` to strip |
