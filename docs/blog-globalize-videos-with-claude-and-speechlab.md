# I dubbed a video into Spanish without leaving Claude Code

[Sabrina Ramonov wrote up how she makes short-form videos by just talking to Claude Code](https://www.sabrina.dev/p/claude-just-changed-content-creation-remotion-video) — the Remotion skill writes the video, she previews it in the browser, she iterates. No editor.

I wanted to see if the next problem could be solved the same way: I have the video, but it's in English. Could I get a Spanish version — real dubbed voice, translated subtitles — without opening a single tool? I added the **SpeechLab skill** to my Claude Code session and asked. Here's the whole thing.

Here's what came out the other end — the speaker's own voice, dubbed to Spanish, subtitles translated and burned in:

![Spanish cut](images/demo-es_la.gif)

▶️ [Watch the full 43-second video](videos/promo-es_la.mp4)

---

## The session

**I typed:**

> I have a Remotion promo in English. Make a Latin-American Spanish version — dub the narration into Spanish in the same voice, overlay the translated subtitles, and render it.

**Claude:**

> That's a Remotion project — I can see the `Main` composition. I'll dub the English narration into Latin-American Spanish with the SpeechLab skill, then have Remotion swap the audio and overlay the translated captions. Starting the dub…

It went off and did it. I didn't pick an API endpoint, look up a language code, or write a fetch — the skill already knew all of that. A few minutes later:

> Dub's done — voice cloned into Spanish, captions translated and time-aligned. I dropped them into the project and rendered it:
>
> ✅ **promo-es_la.mp4** — same promo, Spanish voice, Spanish subtitles. Want more languages?

I opened the file. It was my video, in Spanish, in the original speaker's voice. So I pushed it:

**I typed:**

> Yeah — French, Brazilian Portuguese, Japanese, and Arabic too.

**Claude:**

> Dubbing into `fr`, `pt_br`, `ja`, and `ar_sa`, then rendering each. (Arabic subtitles flip right-to-left automatically.)
>
> ✅ Five videos, one English source.

That was it. The whole job was two sentences in a chat.

---

## Why it works in one session

Two skills were loaded, and Claude just used both:

- the **Remotion skill** knows how to open the project, parametrize it by language, and render it;
- the **SpeechLab skill** knows how to clone the voice, translate the script, and — the part a raw model always gets wrong — *which* calls to make (the Spanish code is `es_la`, not `es`; where the token lives; how to wait for the dub).

You bring the intent. The skills bring the know-how. Nothing to wire up.

---

## Try it

```bash
npx skills add remotion-dev/skills                                   # the video skill (Sabrina's)
claude plugin marketplace add speechlabinc/speechlab-platform-skill  # the globalize skill
claude plugin install speechlab-api
```

Then, in a session with any Remotion video:

> *"Make a Spanish version of this — dub the voice, overlay the subtitles — and render it."*

Skill: https://github.com/speechlabinc/speechlab-platform-skill · MCP: https://github.com/speechlabinc/speechlab-mcp
