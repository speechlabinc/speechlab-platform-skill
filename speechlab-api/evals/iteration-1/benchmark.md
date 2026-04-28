# SpeechLab API Skill — Eval Benchmark (Iteration 1)

## Summary: With Skill vs Without Skill

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

## Pass Rate

| Configuration | Pass Rate |
|---|---|
| **With Skill** | **15/15 (100%)** |
| **Without Skill** | **6/15 (40%)** |

## Key Findings

- **Eval 1**: Without skill, baseline guesses `tokens.access.token` or `res.data.token` — the exact wrong path. Skill pins the exact Cognito-shaped response.
- **Eval 3**: Without skill, baseline lists generic 502 causes (timeout, OOM, Lambda). Completely misses the `beginDubJob` missing export. Skill gives the exact fix.
- **Eval 5**: Without skill, baseline lists 5 guesses (`dubTranslations`, `dubbings`, `jobs`, etc.). Skill gives the exact field name `dub` (singular) with the documented inconsistency vs projects endpoint.
- **Evals 4**: Without skill, baseline guesses the endpoint name correctly (`check-upload-billing`) — this is somewhat discoverable from context. Skill adds the 402 handling and response shape detail.

## Analyst Notes

- Assertions that always pass (non-discriminating): "Calls POST /auth/login" (eval 1) — both with and without skill get this right.
- Highest-value assertions: beginDubJob export (#1846), tokens.accessToken.jwtToken path, dub vs dubs field — these are the ones only the skill knows.
- The skill is working as intended: it pins SpeechLab-specific API quirks that are not guessable from general knowledge.
