---
name: speechlab-api
description: >
  SpeechLab AI dubbing platform API guide for agents and developers.
  Use this skill whenever working with the SpeechLab API — creating projects,
  managing dubs, editing segments, checking billing, setting up test data, or
  integrating the dubbing pipeline into applications or Playwright tests.
  Trigger on: "speechlab API", "create a dub", "POST /dubs/merge", "dub pipeline",
  "translation segments", "check-upload-billing", "import youtube", "createProjectAndDub",
  "beginDubJob", or any question about SpeechLab API endpoints, auth tokens, or
  the characterization tests in tests/integration/api/.
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

### Dev / test account

Use your own account credentials. Store them in environment variables — never hardcode passwords in files or tests.

```bash
export SPEECHLAB_EMAIL="you@example.com"
export SPEECHLAB_PASSWORD="your-password"
export SPEECHLAB_BASE_URL="https://translate-api.speechlab.ai/v1"
```

```js
const token = (await axios.post(`${process.env.SPEECHLAB_BASE_URL}/auth/login`, {
  email: process.env.SPEECHLAB_EMAIL,
  password: process.env.SPEECHLAB_PASSWORD,
})).data.tokens.accessToken.jwtToken;
```

---

## Base URLs

| Environment | URL |
|---|---|
| Local dev | `http://localhost:80/v1` |
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
// targetLanguage and dubAccent require locale-style codes — bare ISO codes ('es', 'fr') return HTTP 400
const { data } = await axios.post(`${BASE}/projects/createProjectAndDub`, {
  name: 'My Video',
  sourceLanguage: 'en',
  targetLanguage: 'es_la',   // locale code required: es_la, es_es, fr, fr_ca, pt_pt, pt_br, ar_sa, etc.
  dubAccent: 'es_la',        // same closed enum as targetLanguage
  mediaFileURI: 's3://speechlab-data-prod/original/uuid/video.mp4',
  voiceMatchingMode: 'native',
  unitType: 'unit',
  isAudioOnlyFile: false,
}, { headers });

// Response is flat — no 'project' wrapper, no _id
// { projectId, jobId, dubStatus }
const { projectId } = data;

// Poll every 5s until dub is COMPLETE
// GET /projects/:id does NOT populate dub on translations — use the list endpoint instead
let dub;
while (true) {
  const projects = (await axios.get(`${BASE}/projects?limit=1&sortBy=createdAt:desc`, { headers })).data;
  // Or poll via /translations/:translationId — both use key 'dub' (singular array)
  const translationId = projects.results?.[0]?.translations?.[0]?._id;
  if (translationId) {
    const t = (await axios.get(`${BASE}/translations/${translationId}`, { headers })).data;
    dub = t.translation?.dub?.[0];   // key is 'dub', not 'dubs'
    if (dub?.status === 'COMPLETE') break;
    if (dub?.status === 'ERROR') throw new Error('Dub failed');
  }
  await new Promise(r => setTimeout(r, 5000));
}

// Export
await axios.post(`${BASE}/projects/exportProject/${projectId}`, {
  type: 'video', targetLang: 'es_la', targetAccent: 'es_la',
  selectedFormat: 'mp4', dubId: dub._id,
}, { headers });
```

### Recipe B: Test Project (YouTube, no file upload)

```js
// Great for integration tests and Playwright test setup
const headers = { Authorization: `Bearer ${token}` };

// Import "Me at the zoo" — 19s, public domain, reliably available
// POST /uploads/import-youtube returns { importId, videoId, status, message } — no fileUuid yet
const { data: imp } = await axios.post(`${BASE}/uploads/import-youtube`,
  { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }, { headers });
const { importId } = imp;

// Poll until status === 'completed', then read fileUuid
let fileUuid;
while (true) {
  const { data: status } = await axios.get(
    `${BASE}/uploads/youtube-import-status/${importId}`, { headers });
  if (status.status === 'completed') { fileUuid = status.fileUuid; break; }
  if (status.status === 'failed') throw new Error('YouTube import failed');
  await new Promise(r => setTimeout(r, 3000));
}

// fileKey must include a file extension — bare UUID causes HTTP 400:
// "format: Path format is required., contentTYpe: Path contentTYpe is required."
const { data } = await axios.post(`${BASE}/projects/createProjectAndTranscribe`, {
  name: `[TEST] ${Date.now()}`,
  language: 'en',
  fileUuid,
  fileKey: `${fileUuid}.mp4`,   // extension required — service calls path.extname(fileKey)
  filenameToReturn: 'test.mp4',
  contentDuration: 19, unitType: 'unit',
}, { headers });

// Response: { project: { id: '...', ...fields } } — field is 'id', not '_id'
const projectId = data.project?.id || data.project?._id;

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
// 200: { success, message, contentId, translationId, dubId, contentDuration,
//        requiredCredits, projectId, projectName, projectOwnerId, organizationId,
//        userEmail, userId, transactionFound }
// NOTE: availableCredits is NOT in the export-billing response (only in check-upload-billing)
// { invoiceBilling: true } when org is on invoice billing
// 402: payment required
```

### Recipe E: Downloading Dubbed Artifacts

There is no shortcut filter or one-call presigned download on the list endpoint.
The correct path depends on what you need:

**Option 1 — Export a specific format** (most common): trigger a server-side
render job, then retrieve the download URL once the job completes.

```js
// Step 1: request the export
const { data: exportJob } = await axios.post(
  `${BASE}/projects/exportProject/${projectId}`,
  {
    type: 'video',
    targetLang: 'es_la',
    targetAccent: 'es_la',
    selectedFormat: 'mp4',
    dubId,
  },
  { headers }
);

// Step 2: poll the returned job until it has a downloadUrl
// (shape varies — check exportJob for a jobId or status field and poll accordingly)
```

**Option 2 — Sign an existing S3 key** you already have (e.g. from
`GET /dubs/:dubId` → `medias[].uri`):

```js
// POST /medias/getMediaPresignedURL  { fileKey: 's3-key-string' }
const { data: signed } = await axios.post(
  `${BASE}/medias/getMediaPresignedURL`,
  { fileKey: dub.medias[0].uri },
  { headers }
);
// signed.presignedURL is a time-limited HTTPS URL you can GET directly
```

**What does NOT work:**
- `GET /projects?thirdPartyID=<id>` → HTTP 400 (`thirdPartyID` is not an
  allowed query param on the list endpoint; it is accepted only in POST body
  at create time)
- `GET /projects/:id?expand=true` does NOT presign media URIs — `dub.medias[].uri`
  remains a bare `s3://` key regardless of the `expand` flag

---

## Supported Languages & Accent Codes

> **Base-vs-variant rule (critical):** `sourceLanguage` uses base ISO codes (e.g. `es`, `pt`).
> `targetLanguage` and `dubAccent` require locale-variant codes (e.g. `es_la`, `pt_br`).
> Passing a bare base code like `es` as `targetLanguage` returns **HTTP 400**.
> When in doubt: source = base, target/dub = variant.

### sourceLanguage codes (transcription phase — 27 codes)

| Code | Language |
|---|---|
| `en` | English |
| `es` | Spanish (Latin America) |
| `es_es` | Spanish (Castilian) |
| `nl` | Dutch |
| `fr` | French |
| `fr_ca` | French (Canadian) |
| `it` | Italian |
| `de` | German |
| `ar` | Arabic |
| `ko` | Korean |
| `ja` | Japanese |
| `hi` | Hindi |
| `zh` | Chinese |
| `pt` | Portuguese |
| `pl` | Polish |
| `tr` | Turkish |
| `sv` | Swedish |
| `ru` | Russian |
| `uk` | Ukrainian |
| `id` | Indonesian |
| `vi` | Vietnamese |
| `th` | Thai |
| `da` | Danish |
| `ga` | Irish |
| `ms` | Malay |
| `yue` | Cantonese |
| `kk` | Kazakh |

### targetLanguage codes (translation phase — 28 codes)

| Code | Language |
|---|---|
| `en` | English |
| `es_la` | Spanish (Latin America) |
| `es_es` | Spanish (Castilian) |
| `nl` | Dutch |
| `fr` | French |
| `fr_ca` | French (Canadian) |
| `it` | Italian |
| `de` | German |
| `ar` | Arabic |
| `ko` | Korean |
| `ja` | Japanese |
| `hi` | Hindi |
| `zh` | Chinese |
| `pt_pt` | Portuguese (European) |
| `pt_br` | Portuguese (Brazilian) |
| `pl` | Polish |
| `tr` | Turkish |
| `sv` | Swedish |
| `ru` | Russian |
| `uk` | Ukrainian |
| `id` | Indonesian |
| `vi` | Vietnamese |
| `th` | Thai |
| `da` | Danish |
| `ga` | Irish |
| `ms` | Malay |
| `yue` | Cantonese |
| `kk` | Kazakh |

### dubAccent codes (dub phase — 30 codes)

`dubAccent` is a superset of `targetLanguage` — it adds two Arabic regional accents (`ar_sa`, `ar_eg`).

| Code | Language / Accent |
|---|---|
| `en` | English |
| `es_la` | Spanish (Latin America) |
| `es_es` | Spanish (Castilian) |
| `nl` | Dutch |
| `fr` | French |
| `fr_ca` | French (Canadian) |
| `it` | Italian |
| `de` | German |
| `ar` | Arabic |
| `ar_sa` | Arabic (Saudi Arabia) |
| `ar_eg` | Arabic (Egyptian) |
| `ko` | Korean |
| `ja` | Japanese |
| `hi` | Hindi |
| `zh` | Chinese |
| `pt_pt` | Portuguese (European) |
| `pt_br` | Portuguese (Brazilian) |
| `pl` | Polish |
| `tr` | Turkish |
| `sv` | Swedish |
| `ru` | Russian |
| `uk` | Ukrainian |
| `id` | Indonesian |
| `vi` | Vietnamese |
| `th` | Thai |
| `da` | Danish |
| `ga` | Irish |
| `ms` | Malay |
| `yue` | Cantonese |
| `kk` | Kazakh |

---

## Key API Endpoints Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Register new account |
| POST | `/auth/register/confirmation` | ❌ | Confirm email with 6-digit code |
| POST | `/auth/login` | ❌ | Login → `tokens.accessToken.jwtToken` |
| POST | `/auth/refresh-tokens` | ❌ | Refresh access token |
| POST | `/auth/logout` | ✅ | Invalidate session |
| GET | `/projects` | ✅ | List projects (`?limit=10&sortBy=createdAt:desc`). `thirdPartyID` is NOT a valid query param — returns 400 |
| GET | `/projects/:projectId` | ✅ | Project with translations. Does NOT populate `dub` on translations. `expand=true` does NOT presign URLs. Use list endpoint or `GET /translations/:id` for dub status |
| PATCH | `/projects/:projectId` | ✅ | Update name, isDeleted, etc. |
| POST | `/projects/createProjectAndDub` | ✅ | Create project + full pipeline |
| POST | `/projects/createProjectAndTranscribe` | ✅ | Create project + transcription only |
| POST | `/projects/exportProject/:projectId` | ✅ | Export dubbed video |
| GET | `/translations/:translationId` | ✅ | Translation with segments + `dub` array (singular key — not `dubs`) |
| PATCH | `/translations/:translationId/segments/:segmentId` | ✅ | Edit one segment |
| POST | `/translations/:translationId/uploadCSV/:accent` | ✅ | Bulk update via CSV |
| GET | `/translations/:translationId/export/csv` | ✅ | Download segments as CSV |
| GET | `/dubs/:dubId` | ✅ | Dub with status + medias |
| PATCH | `/dubs/:dubId` | ✅ | Update dub fields |
| POST | `/dubs/merge` | ✅ | Merge segments → final audio (fix #1846) |
| POST | `/dubs/synthesize` | ✅ | Synthesize one segment → presigned URL |
| POST | `/dubs/check-upload-billing` | ✅ | Credits check before upload |
| POST | `/dubs/check-export-billing` | ✅ | Credits check before export |
| POST | `/uploads/import-youtube` | ✅ | Start YouTube import → `{ importId, videoId, status, message }`. No `fileUuid` yet — poll status endpoint |
| GET | `/uploads/youtube-import-status/:importId` | ✅ | Poll import status → `{ importId, videoId, status, progress, fileUuid, hasCaptions, captionLanguages }` |
| POST | `/uploads/initialize-multipart-upload` | ✅ | Start S3 multipart upload |
| POST | `/uploads/get-multipart-preSigned-urls` | ✅ | Get S3 signed URLs |
| POST | `/uploads/finalize-multipart-upload` | ✅ | Finalize multipart upload |
| POST | `/medias/getMediaPresignedURL` | ✅ | Sign an existing S3 key → time-limited HTTPS URL |
| GET | `/users/:userId/balance` | ✅ | Credit balance |

---

## Error Codes

| Code | Meaning | Common cause |
|---|---|---|
| 400 | Bad request / missing auth | Validation error or no `Authorization` header |
| 401 | Unauthorized | Invalid or expired JWT |
| 402 | Payment required | Insufficient credits |
| 403 | Forbidden | Missing role/permission |
| 404 | Not found | Wrong ID or deleted resource |
| 409 | Conflict | Dub already exists for this language |
| 502 | Bad Gateway | ML API error, or `beginDubJob` not exported (#1846) |
| 500 | Server error | Check server logs |

---

## Test Data Helpers

```js
// tests/utils/devApi.js — shared client already in this repo
const { login, makeClient, authedClient } = require('../../tests/utils/devApi');

const client = await authedClient(); // returns pre-authorized axios instance

async function createTestProject(client, name = `[TEST] ${Date.now()}`) {
  // Step 1: start import — response has no fileUuid yet
  const imp = await client.post('/uploads/import-youtube',
    { url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' });
  const { importId } = imp.data;

  // Step 2: poll until completed
  let fileUuid;
  while (true) {
    const status = await client.get(`/uploads/youtube-import-status/${importId}`);
    if (status.data.status === 'completed') { fileUuid = status.data.fileUuid; break; }
    if (status.data.status === 'failed') throw new Error('YouTube import failed');
    await new Promise(r => setTimeout(r, 3000));
  }

  // Step 3: create project — fileKey must include extension
  const proj = await client.post('/projects/createProjectAndTranscribe', {
    name, language: 'en', fileUuid,
    fileKey: `${fileUuid}.mp4`,   // extension required
    filenameToReturn: 'test.mp4', contentDuration: 19, unitType: 'unit',
  });
  // response: { project: { id: '...' } } — field is 'id' not '_id'
  return proj.data.project?.id || proj.data.project?._id;
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
| `dub` (singular) | Both `GET /projects` (list) and `GET /translations/:id` use key `dub` (array). `GET /projects/:id` (detail) does NOT populate `dub` at all — do not poll status via the detail endpoint |
| #1846 — 502 on merge | `beginDubJob` must be in `module.exports` of `dub.service.js` |
| isMerge logic | All `fileNameToDubs[dubKey]` non-empty → fast merge; any empty → full re-synthesis |
| Sequential batch dubs | `POST /dubs/multiple` runs sequentially to avoid isMerge race condition (#1698) |
| `isOver30Minutes` | Only in `check-upload-billing` response on the paid/credit-check path |
| voiceMatchingMode | All dubs stored as `customized` internally; per-speaker config controls actual mode |
| Locale codes required | `targetLanguage` and `dubAccent` must be locale-style codes (`es_la`, `es_es`, `fr`, `fr_ca`, `pt_pt`, `pt_br`, `ar_sa`, `ar_eg`, `yue`, `kk`, …). Bare ISO codes like `'es'` return HTTP 400 |
| YouTube import: poll for fileUuid | `POST /uploads/import-youtube` returns `importId` only. Poll `GET /uploads/youtube-import-status/:importId` until `status === 'completed'` before reading `fileUuid` |
| fileKey needs extension | `createProjectAndTranscribe` `fileKey` must include a file extension (`fileUuid + '.mp4'`). Bare UUID causes HTTP 400 — service calls `path.extname(fileKey)` to derive `format` and `contentTYpe` |
| createProjectAndDub response | Response is flat: `{ projectId, jobId, dubStatus }`. There is no `data.project._id` wrapper |
| createProjectAndTranscribe response | `data.project.id` (not `_id`) |
| thirdPartyID not filterable | `GET /projects?thirdPartyID=<id>` returns HTTP 400. `thirdPartyID` is accepted at creation time (POST body) but there is no list-by-thirdPartyID filter |
| expand=true does not presign | `GET /projects/:id?expand=true` does NOT presign `dub.medias[].uri`. URIs remain bare `s3://` keys. Use `POST /medias/getMediaPresignedURL { fileKey }` or trigger an export job |
| check-export-billing: no availableCredits | `POST /dubs/check-export-billing` response does not include `availableCredits`. That field is only in `check-upload-billing` |
