# Changelog

All notable changes to speechlab-platform-skill are documented here.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] — 2026-06-04

Initial public release of the speechlab-platform-skill Claude Code plugin.

### Added

- **`speechlab-api` skill** — SKILL.md with full frontmatter trigger phrases and agent instructions covering the complete SpeechLab dubbing pipeline
- **Auth flow** — Register, email confirmation, login, refresh, logout. Documents the correct `tokens.accessToken.jwtToken` extraction path (not `tokens.access.token`) and the 400-not-401 behavior when the Authorization header is missing
- **Two upload source paths** — Multipart Upload API (`initialize` → presigned PUT → `finalize`) for local files; direct `mediaFileURI` for public HTTPS URLs. Includes the S3 SigV2 `Content-Type:` header-strip fix for curl users
- **Project lifecycle recipes** — `createProjectAndDub` (single-call HTTPS pipeline), `createProjectAndTranscribe` (upload-then-transcribe), YouTube import shortcut for test fixtures, and soft-delete cleanup pattern
- **Correct POST body shapes** — `POST /translations` and `POST /dubs` document the real request bodies, which differ from the OpenAPI spec on both endpoints
- **Status polling pattern** — `NOT_STARTED → SUBMITTED → GENERATING → PROCESSING → COMPLETE / ERROR` lifecycle documented for both `status` (synthesis) and `mergeStatus` (audio merge)
- **Fast artifact download path** — `GET /projects?thirdPartyIDs=…&expand=true` returns presigned download URLs for every artifact in one round-trip, with no export job required. Documented as the primary recommended download path
- **Standard export path** — `exportProject` → `collectionjobs` polling → download, with long-form `selectedFormat` tokens (`videoMp4`, `audioMp3`, `subtitleSrt`, `transcriptTxt`) and the 22-byte empty-zip silent-failure fix
- **Billing checks** — `check-upload-billing` and `check-export-billing` request/response shapes, free-tier eligibility path, and HTTP 402 handling with exact user instructions for topping up via the web UI
- **Segment edit and re-merge** — Edit one translation segment, re-synthesize it via `POST /dubs/synthesize`, and re-merge the full dub via `POST /dubs/merge`
- **Known API bug: #1846** — `beginDubJob` not exported from `dub.service.js` causes `POST /dubs/merge` to return 502; skill surfaces this as the first diagnosis rather than generic 502 causes
- **Known field inconsistency: `dub` vs `dubs`** — `GET /translations/:id` returns `dub` (singular array); `GET /projects/:id` returns `translations[].dubs` (plural array)
- **Known mount path corrections** — Real routes are `/medias/...` and `/collectionjobs` (no hyphen); OpenAPI spec incorrectly lists `/media/...` and `/collection-jobs`
- **`thirdPartyID` guidance** — Set at project create time; cannot be patched in later; enables the `expand=true` fast-lookup path
- **`voiceMatchingMode` clarification** — `source`, `native`, and `customized` modes documented; all dubs stored internally as `customized` regardless of the requested mode
- **Test data helpers** — Reusable Node.js `login()`, `authedClient()`, `createTestProject()`, `deleteTestProject()` utility functions using the YouTube import pattern
- **Plugin marketplace manifest** — `.claude-plugin/marketplace.json` enabling `./plugin marketplace add speechlabinc/speechlab-platform-skill`
- **Eval suite** — 5 prompts with 15 assertions in `speechlab-api/evals/evals.json`; iteration-1 benchmark shows 100% pass rate with skill vs 40% without
- **MIT License**

---

[Unreleased]: https://github.com/speechlabinc/speechlab-platform-skill/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/speechlabinc/speechlab-platform-skill/releases/tag/v1.0.0
