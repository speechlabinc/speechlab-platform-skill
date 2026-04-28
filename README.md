# speechlab-platform-skill

A [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) **Skill** that teaches Claude how to use the SpeechLab AI dubbing platform API — auth, projects, translations, dubs, segments, billing, and the gotchas that aren't obvious from the OpenAPI spec.

When this skill is installed, Claude will automatically reach for the right endpoints, the correct JWT token path (`tokens.accessToken.jwtToken`), the right field names (`dub` vs `dubs`), and the known issues (#1846 `beginDubJob` export bug, etc.) the moment you ask anything about SpeechLab.

| Without skill | With skill |
|---|---|
| 6/15 assertions pass (40%) | **15/15 assertions pass (100%)** |

See [`speechlab-api/evals/iteration-1/benchmark.md`](speechlab-api/evals/iteration-1/benchmark.md) for the full benchmark.

---

## Install

### Project-scoped (recommended)

Make the skill available only inside one project. Run from the root of the project you want to use it in:

```bash
git clone https://github.com/speechlabinc/speechlab-platform-skill.git /tmp/speechlab-platform-skill
mkdir -p .claude/skills
cp -R /tmp/speechlab-platform-skill/speechlab-api .claude/skills/
```

Commit `.claude/skills/speechlab-api/` so your team picks it up automatically.

### User-scoped (all projects)

Make the skill available to every project on your machine:

```bash
git clone https://github.com/speechlabinc/speechlab-platform-skill.git /tmp/speechlab-platform-skill
mkdir -p ~/.claude/skills
cp -R /tmp/speechlab-platform-skill/speechlab-api ~/.claude/skills/
```

### Verify

Start a Claude Code session and ask something like *"How do I log into the SpeechLab dev API?"*. Claude should automatically load the skill (you'll see it referenced) and answer with the exact `tokens.accessToken.jwtToken` path.

You can also check it's discoverable:

```bash
ls .claude/skills/speechlab-api/SKILL.md   # project install
ls ~/.claude/skills/speechlab-api/SKILL.md # user install
```

---

## Example prompts

Once installed, just talk to Claude in plain English — the skill triggers automatically. The first prompt below is the exact one we used end-to-end in [a real session](#real-session-walkthrough): upload a local file, dub it, and download every artifact.

### End-to-end dub from a local file

> *"Using the SpeechLab skill, I want to dub the following video and download the subtitles, captions, audio and final dub video. `/Users/me/clips/lecture.mov`"*

Claude will:

1. Log in (or register) on the dev API and store the JWT
2. Run `check-upload-billing` and the user balance check
3. Initialize a multipart upload, split the file, sign each part, `PUT` to S3 (with no `Content-Type` header — that's a SigV2 gotcha curl gets wrong by default), then `finalize-multipart-upload`
4. `POST /projects/createProjectAndDub` with an **HTTPS** `mediaFileURI` (`s3://` URIs error with *"Unsupported protocol s3:"* on dev)
5. Poll the project until `dubs[0].status === 'COMPLETE'`
6. Export `srt`, `wav`, `txt`, and `mp4` and download each artifact to a local folder

### A few more examples

> *"Translate just the first 30 seconds of `/path/to/keynote.mp4` into Spanish (es_la), Portuguese (pt_br) and French — give me the SRT files only."*

> *"Import this YouTube clip and run a Mandarin dub with native voices: `https://www.youtube.com/watch?v=jNQXAC9IVRw`"*

> *"My dub `65c0d456789abc012ef34567` is stuck in `mergeStatus: SUBMITTED`. Check the project, look at issue #1846, and tell me what's wrong."*

> *"Edit segment 3 of translation `6696e019413fff002e0df67b` to say *'Bienvenidos a Java 101'*, re-synthesize that one segment, then re-merge the dub."*

> *"Before I upload a 14-minute interview, run `check-upload-billing` and `check-export-billing` and tell me how many credits I'll burn."*

> *"List my last 10 projects sorted by `createdAt` and delete every project whose name starts with `[TEST]`."*

### Real-session walkthrough

The first example above (the local-file end-to-end dub) was the exact prompt used to develop and exercise this skill. Notable things Claude learned to handle along the way and now does without prompting:

| Gotcha | Fix the skill knows |
|---|---|
| `curl --data-binary @file` adds `Content-Type: application/x-www-form-urlencoded`, breaking the S3 SigV2 signature | Pass `-H "Content-Type:"` to strip it |
| `mediaFileURI: 's3://...'` returns *"Unsupported protocol s3:"* on dev | Use the bucket's HTTPS URL form |
| `tokens.access.token` is wrong | Use `tokens.accessToken.jwtToken` |
| Project lookups return `dubs` (plural); translation lookups return `dub` (still an array) | Skill warns when you mix them up |
| Free-tier dev account starts at 0 credits, but uploads under 30 min for the first 2 projects are free | The skill calls `check-upload-billing` first to confirm the `freeUpload: true` path |

---

## What's in this repo

```
speechlab-api/
├── SKILL.md                      # the skill itself — frontmatter + instructions
└── evals/
    ├── evals.json                # 5 prompts + assertions used to benchmark the skill
    └── iteration-1/
        └── benchmark.md          # with-skill vs without-skill pass-rate comparison
```

---

## What the skill covers

- **Auth** — register / confirm / login / refresh, including the nested `tokens.accessToken.jwtToken` path that's easy to get wrong
- **Project lifecycle** — `createProjectAndDub`, `createProjectAndTranscribe`, polling, export
- **Translations & segments** — edit one segment, re-synthesize, re-merge
- **Billing** — `check-upload-billing` and `check-export-billing`, 402 handling
- **Test data** — YouTube import flow for cheap test fixtures, cleanup pattern
- **Known gotchas** — `dub` vs `dubs` field naming, no-auth → 400 (not 401), `beginDubJob` export bug, sequential batch dubs, `voiceMatchingMode` storage

---

## Updating

This skill is maintained alongside the SpeechLab API. To pull the latest version:

```bash
cd /tmp/speechlab-platform-skill && git pull
cp -R /tmp/speechlab-platform-skill/speechlab-api ~/.claude/skills/   # or your project path
```

---

## License

MIT — see [LICENSE](LICENSE).
