# Make a video with Claude. Reach the whole planet — in one more sentence.

[Sabrina Ramonov showed how Claude Code + the Remotion skill turns a prompt into a finished short-form video](https://www.sabrina.dev/p/claude-just-changed-content-creation-remotion-video). No editor, no timeline — just a conversation. It's a glimpse of the new content pipeline: **you describe, the agent makes.**

But every video that pipeline produces has the same ceiling. It's in English. **About 3 out of 4 people on Earth don't speak English** — and on every platform, native-language video gets dramatically more watch time, completion, and shares than subtitled foreign content. You made something great and then handed 75% of your potential audience a reason to scroll past.

Here's how you fix that without leaving the chat. Add the **SpeechLab skill** to the same Claude Code session, and your video goes global by *asking*.

---

## The demo

You just made a 9:16 promo with the Remotion skill. You type one line:

> **You:** Globalize this into Spanish, French, Portuguese, Japanese, and Arabic — same voice, translated captions. Then re-render each one.

> **Claude:** On it. Dubbing your narration into all five (voice-cloned, so it stays *your* speaker), pulling translated captions, and re-rendering one localized cut per language…
>
> ✅ Done. Five videos in `out/` — `promo-es_la.mp4`, `promo-fr.mp4`, `promo-pt_br.mp4`, `promo-ja.mp4`, `promo-ar_sa.mp4`. Same visuals, same voice, five languages.

That's it. One English video in, five markets out. You wrote no code and never opened an API.

> 🎙️ **The voice is the magic.** SpeechLab clones your speaker, so the Spanish version sounds like *you* speaking Spanish — not a robotic auto-dub. Audiences can tell the difference, and they stay.

---

## Why you'd actually do this

- **10× your reachable audience.** English → +5 languages can put you in front of billions more people, in the language they actually watch in.
- **More views, free.** Localized video lifts completion and shares on every platform's algorithm. Same content, multiplied.
- **Your voice everywhere.** Voice cloning keeps your identity intact across languages — brand-safe, creator-safe.
- **Zero extra production.** No vendors, no re-records, no timelines. It's one more sentence in a chat you were already having.

---

## It drops into the whole agentic content flywheel

This isn't a one-off trick — it's a stage in a pipeline you can run end to end from one Claude Code session:

```
  CREATE                GLOBALIZE              POST
  Remotion skill   →    SpeechLab skill   →    scheduling MCP
  "make the video"      "dub into 30 langs"    "post to every channel"
```

1. **Create** — the Remotion skill writes and renders the video from your prompt.
2. **Globalize** — the SpeechLab skill dubs + translates it into every market.
3. **Post** — hand the localized files to a social-scheduling MCP (Blotato, etc.) and Claude publishes them, per-language, on schedule.

One conversation: idea → finished video → 30 localized versions → posted everywhere. That's the content flywheel, fully agentic.

> Each step is just a skill or MCP Claude already knows how to use. The SpeechLab skill carries the dubbing know-how so the agent gets it right the first time — you supply the intent, it supplies the expertise.

---

## Get started

```bash
# 1. The Remotion skill (make videos) — Sabrina's starting point
npx skills add remotion-dev/skills

# 2. The SpeechLab skill (globalize them)
claude plugin marketplace add speechlabinc/speechlab-platform-skill
claude plugin install speechlab-api
```

Then, in any Claude Code session with a Remotion video open:

> *"Globalize this into Spanish and re-render."*  → then →  *"Now five more languages."*

A runnable example that renders an English **and** a Latin-American Spanish cut from real SpeechLab dubbed audio lives in [`examples/remotion-globalization`](../examples/remotion-globalization).

- **SpeechLab skill:** https://github.com/speechlabinc/speechlab-platform-skill
- **SpeechLab MCP server** (`npx speechlab-mcp`, for tool-based agents): https://github.com/speechlabinc/speechlab-mcp
- **Remotion skill:** https://github.com/remotion-dev/remotion/tree/main/packages/skills/skills/remotion

Make it once. Reach everyone.
