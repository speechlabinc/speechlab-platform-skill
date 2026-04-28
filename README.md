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
