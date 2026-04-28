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

## Complete Workflow Recipes

### Recipe A: Full Dub Pipeline (single call)

```js
const { tokens } = (await axios.post(`${BASE}/auth/login`, { email, password })).data;
const token = tokens.accessToken.jwtToken;
const headers = { Authorization: `Bearer ${token}` };

// Create project + start full pipeline in one shot
const { data } = await axios.post(`${BASE}/projects/createProjectAndDub`, {
  name: 'My Video',
  sourceLanguage: 'en',
  targetLanguage: 'es',
  dubAccent: 'es',
  mediaFileURI: 's3://speechlab-data-prod/original/uuid/video.mp4',
  voiceMatchingMode: 'native',
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

// Export
await axios.post(`${BASE}/projects/exportProject/${projectId}`, {
  type: 'video', targetLang: 'es', targetAccent: 'es',
  selectedFormat: 'mp4', dubId: dub._id,
}, { headers });
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

### Recipe E: Direct artifact download via Get Projects + `expand` (alternative to Export)

If the project was created with a `thirdPartyID` (your own correlation ID,
passed at create time), `GET /projects` with `thirdPartyID` and `expand=true`
returns the project plus **pre-signed download URLs for every artifact already
on the project** in a single response — no `exportProject` call, no
`/dubs/exportDub` poll, no waiting on a separate download job. Use this whenever
the artifacts you want already exist; fall back to Export + Download only when
you need a *new* format that hasn't been generated yet.

```js
// One call → presigned URLs for every existing artifact on the project
const { data } = await axios.get(`${BASE}/projects`, {
  params: { thirdPartyID: 'job-2026-04-28-keynote', expand: true },
  headers,
});

const project = data.results?.[0] ?? data[0];
const dub = project.translations?.[0]?.dubs?.[0];

// Each artifact comes with a presigned URL ready for an immediate GET.
// Common shape (subject to API version): dub.medias[] with
//   { format: 'mp4'|'wav'|'srt'|'txt', language, uri /* presigned */ }
// Project-level artifacts (subtitles, captions) may also live on
// project.transcription.medias[] or translation.medias[].
for (const media of dub.medias ?? []) {
  const file = await axios.get(media.uri, { responseType: 'stream' });
  file.data.pipe(fs.createWriteStream(`./out/${media.format}`));
}
```

**When to use which path**:

| Need | Use |
|---|---|
| Already have a `thirdPartyID` and the artifacts already exist on the project | `GET /projects?thirdPartyID=…&expand=true` (this recipe) — one call, presigned URLs, no polling |
| Need a *new* artifact format that hasn't been generated yet | `POST /projects/exportProject/:projectId` then poll + download (Recipe A) |
| Don't have a `thirdPartyID` | Fetch by `_id`: `GET /projects/:projectId?expand=true` works the same way |

**Gotcha**: `expand=true` is what triggers the presign — without it, the URLs are bare S3 keys you can't download from. Always pass it explicitly.

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
| GET | `/projects?thirdPartyID=<id>&expand=true` | ✅ | Project lookup by your own correlation ID, with **presigned download URLs** included — alternative to Export+Download (see Recipe E) |
| GET | `/projects/:projectId?expand=true` | ✅ | Same shape as above when you have the internal `_id` |
| GET | `/projects/:projectId` | ✅ | Full project with translations + dubs populated |
| PATCH | `/projects/:projectId` | ✅ | Update name, isDeleted, etc. |
| POST | `/projects/createProjectAndDub` | ✅ | Create project + full pipeline |
| POST | `/projects/createProjectAndTranscribe` | ✅ | Create project + transcription only |
| POST | `/projects/exportProject/:projectId` | ✅ | Export dubbed video |
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
| `dub` vs `dubs` | `GET /translations/:id` returns `dub` (array). Projects endpoint returns `dubs` |
| #1846 — 502 on merge | `beginDubJob` must be in `module.exports` of `dub.service.js` |
| isMerge logic | All `fileNameToDubs[dubKey]` non-empty → fast merge; any empty → full re-synthesis |
| Sequential batch dubs | `POST /dubs/multiple` runs sequentially to avoid isMerge race condition (#1698) |
| `isOver30Minutes` | Only in `check-upload-billing` response on the paid/credit-check path |
| voiceMatchingMode | All dubs stored as `customized` internally; per-speaker config controls actual mode |
