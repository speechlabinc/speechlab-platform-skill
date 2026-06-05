# SpeechLab API Skill — Eval Benchmark

The suite now has **9 evals**. Evals 1–5 were measured in iteration-1
(with-skill vs without-skill, results below). Evals 6–9 were added to cover
four additional flows; they have **not** been run yet, so no pass numbers are
claimed for them — only a description of what each one checks.

---

## Iteration-1 Measured Results (Evals 1–5)

### Summary: With Skill vs Without Skill

| Eval | Assertion | With Skill | Without Skill |
|---|---|---|---|
| 1 — JWT token | Uses `tokens.accessToken.jwtToken` | ✅ PASS | ❌ FAIL (guesses wrong path) |
| 1 — JWT token | Calls POST /auth/login | ✅ PASS | ✅ PASS (guesses /auth) |
| 1 — JWT token | Sets Authorization Bearer header | ✅ PASS | ✅ PASS |
| 2 — YouTube import | Uses /uploads/import-youtube | ✅ PASS | ❌ FAIL (doesn't know endpoint) |
| 2 — YouTube import | Uses createProjectAndTranscribe | ✅ PASS | ❌ FAIL |
| 2 — YouTube import | Mentions fileUuid extraction | ✅ PASS | ❌ FAIL |
| 2 — YouTube import | Mentions isDeleted cleanup | ✅ PASS | ❌ FAIL |
| 3 — 502 on merge | Mentions beginDubJob not exported | ✅ PASS | ❌ FAIL (generic 502 causes) |
| 3 — 502 on merge | References issue #1846 | ✅ PASS | ❌ FAIL |
| 3 — 502 on merge | Mentions module.exports | ✅ PASS | ❌ FAIL |
| 4 — upload billing | Uses /dubs/check-upload-billing | ✅ PASS | ✅ PASS (guesses correctly) |
| 4 — upload billing | Passes duration: 120 | ✅ PASS | ✅ PASS |
| 4 — upload billing | Explains 402 response | ✅ PASS | ✅ PASS |
| 5 — field name | Identifies "dub" (singular) | ✅ PASS | ❌ FAIL (guesses multiple options) |
| 5 — field name | Distinguishes dub vs dubs | ✅ PASS | ❌ FAIL |

### Pass Rate (Evals 1–5 only)

| Configuration | Pass Rate |
|---|---|
| **With Skill** | **15/15 (100%)** |
| **Without Skill** | **6/15 (40%)** |

### Key Findings

- **Eval 1**: Without skill, baseline guesses `tokens.access.token` or `res.data.token` — the exact wrong path. Skill pins the exact Cognito-shaped response.
- **Eval 3**: Without skill, baseline lists generic 502 causes (timeout, OOM, Lambda). Completely misses the `beginDubJob` missing export. Skill gives the exact fix.
- **Eval 5**: Without skill, baseline lists 5 guesses (`dubTranslations`, `dubbings`, `jobs`, etc.). Skill gives the exact field name `dub` (singular) with the documented inconsistency vs projects endpoint.
- **Eval 4**: Without skill, baseline guesses the endpoint name correctly (`check-upload-billing`) — this is somewhat discoverable from context. Skill adds the 402 handling and response shape detail.

---

## New Evals (6–9) — Not Yet Run

These four were added to widen coverage to the multipart upload flow, segment
editing, credit-exhaustion handling, and token refresh. Each is grounded in
`SKILL.md` so the assertions check skill-specific facts, not guessable general
knowledge. No pass/fail numbers are reported until the suite is executed.

| Eval | Flow under test | What its assertions verify |
|---|---|---|
| 6 — multipart/presigned upload | Direct large-file S3 upload (not YouTube import) | Three-step order: `/uploads/initialize-multipart-upload` → `/uploads/get-multipart-preSigned-urls` → `/uploads/finalize-multipart-upload`, and that part bytes are PUT to the presigned/signed URLs |
| 7 — segment edit + re-merge | Fixing one segment and rebuilding final audio (Recipe C) | Edit via `PATCH /translations/:id/segments/:segmentId`, re-merge via `POST /dubs/merge`, that `translationId`/`contentId`/`dubId` are passed, and that re-synthesis or the resulting `mergeStatus: SUBMITTED` is mentioned |
| 8 — 402 insufficient credits | Correct behavior when billing check returns 402 | That 402 = insufficient credits and must **not** be auto-retried or auto-topped-up (no purchase endpoint exists), directs user to the translate UI "Buy more credits" flow, references status 402, and names the failing step (`upload`) |
| 9 — OAuth / token refresh | Recovering from an expired JWT without re-login | Uses `POST /auth/refresh-tokens`, sources the token from `tokens.refreshToken.token`, identifies that an expired/invalid token returns **401**, and re-applies the refreshed JWT to the `Authorization: Bearer` header |

### Why these are high-value (discrimination rationale)

- **Eval 6**: The exact three endpoint names and their ordering are not guessable; a baseline typically invents a single `/upload` call or a generic S3 SDK flow.
- **Eval 7**: The `dub`/segment/merge relationship and the `/dubs/merge` payload keys are SpeechLab-specific; baselines tend to assume editing the segment alone updates the audio.
- **Eval 8**: The "do not auto-purchase / no purchase endpoint / stop the pipeline" policy is a deliberate skill rule a baseline would violate by retrying or attempting a top-up call.
- **Eval 9**: The nested `tokens.refreshToken.token` path and the 400-vs-401 distinction (missing header = 400, expired = 401) are documented quirks a baseline commonly gets wrong.

---

## Analyst Notes

- Assertions that always pass (non-discriminating) in iteration-1: "Calls POST /auth/login" (eval 1) and all of eval 4 — both with and without skill get these right.
- Highest-value assertions in iteration-1: beginDubJob export (#1846), `tokens.accessToken.jwtToken` path, `dub` vs `dubs` field — only the skill knows these.
- Evals 6–9 are expected to be skill-discriminating for the reasons above, but this should be confirmed by an actual with/without run before reporting a pass rate.
- The skill is working as intended: it pins SpeechLab-specific API quirks that are not guessable from general knowledge.
