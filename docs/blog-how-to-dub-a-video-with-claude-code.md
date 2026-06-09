# How to dub a video into another language with Claude Code

**SpeechLab is an AI dubbing and translation platform that clones a speaker's voice and re-voices their video into 50+ languages, with translated, time-aligned subtitles.** Its [Claude Code](https://claude.com/claude-code) skill lets you dub a video by describing what you want in plain language — no API calls, no language codes, no editor. This post shows the full session: one English Remotion video turned into Spanish, French, Brazilian Portuguese, Japanese, and Arabic versions in two sentences of chat.

Here's the result — the real footage, the speaker's own voice dubbed to Spanish, and the translated subtitles burned in by Remotion:

![Real video dubbed to Spanish with subtitles burned in](images/demo-es_la.gif)

▶️ [Watch the full clip with the Spanish dubbed audio](videos/subtitled-es_la.mp4)

---

## What you need

| Requirement | Why |
|---|---|
| Claude Code | The session driver — it loads the skills and runs the job. |
| The **SpeechLab skill** | Knows the dubbing API, the language codes, and how to wait for a dub. |
| The **Remotion skill** (optional) | Renders the video and overlays subtitles. Skip it if you just want the dubbed audio + subtitle files. |
| A video to dub | Any source video. In this example it's a Remotion promo, but it can be any MP4. |

Install:

```bash
npx skills add remotion-dev/skills                                   # the video skill (optional)
claude plugin marketplace add speechlabinc/speechlab-platform-skill  # the SpeechLab skill
claude plugin install speechlab-api
```

---

## How to dub a video in Claude Code (step by step)

You don't run these steps yourself — you describe the outcome and the skill executes them. This is what happens under the hood:

1. **Describe the job.** Tell Claude the source language, the target language(s), and whether you want subtitles.
2. **The skill picks the right call.** It resolves the correct language code (Latin-American Spanish is `es_la`, not `es`), reads your API token, and submits the dub.
3. **Voice cloning runs.** SpeechLab clones the original speaker's voice and re-voices the translated script in that voice.
4. **Subtitles are translated and time-aligned.** Captions are generated in the target language and aligned to the new audio. Right-to-left languages (e.g. Arabic) flip automatically.
5. **Remotion swaps the audio and renders.** The project's audio track is replaced and the translated captions are overlaid, then each language is rendered to its own MP4.

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

The whole job was two sentences in a chat.

---

## Why it works in one session

Two skills were loaded, and Claude used both:

- the **Remotion skill** knows how to open the project, parametrize it by language, and render it;
- the **SpeechLab skill** knows how to clone the voice, translate the script, and — the part a raw model always gets wrong — *which* calls to make (the Spanish code is `es_la`, not `es`; where the token lives; how to wait for the dub to finish).

You bring the intent. The skills bring the know-how. There is nothing to wire up.

---

## Common questions

**How do I dub a video in Claude Code?**

Install the SpeechLab skill (`claude plugin marketplace add speechlabinc/speechlab-platform-skill` then `claude plugin install speechlab-api`), open a Claude Code session with your video, and describe the result you want — for example, "Make a Spanish version of this, dub the voice and overlay subtitles." The skill submits the dub to SpeechLab, clones the speaker's voice, translates and time-aligns the subtitles, and returns the dubbed files. You never write an API call or look up a language code.

**Does AI dubbing keep the original speaker's voice?**

Yes. SpeechLab uses voice cloning, so the dubbed audio sounds like the original speaker in the new language, not a generic synthetic voice. This is the main difference from YouTube's automatic dubbing, which uses a stock voice and gives you no editing control.

**Which languages and language codes does SpeechLab support?**

50+ languages. This example used Latin-American Spanish (`es_la`), French (`fr`), Brazilian Portuguese (`pt_br`), Japanese (`ja`), and Saudi Arabic (`ar_sa`). Note that regional variants matter — Latin-American Spanish is `es_la`, not `es`. The skill resolves the correct code for you, so you can just say "Latin-American Spanish."

**Does SpeechLab handle right-to-left subtitles?**

Yes. For right-to-left languages such as Arabic and Hebrew, the translated subtitles are flipped to render right-to-left automatically — you don't configure anything.

**Can I dub one video into multiple languages at once?**

Yes. In this session one English source produced five language versions (Spanish, French, Brazilian Portuguese, Japanese, and Arabic) by naming the target languages in a single message. Each language is dubbed and rendered to its own MP4.

**Do I need the Remotion skill?**

No. The Remotion skill renders the final video and burns in subtitles, which is convenient for Remotion projects. If you only need the dubbed audio track and a translated subtitle file for any MP4, the SpeechLab skill alone is enough.

---

## Try it

```bash
npx skills add remotion-dev/skills                                   # the video skill (Sabrina's)
claude plugin marketplace add speechlabinc/speechlab-platform-skill  # the globalize skill
claude plugin install speechlab-api
```

Then, in a session with any video:

> *"Make a Spanish version of this — dub the voice, overlay the subtitles — and render it."*

---

*This approach was inspired by [Sabrina Ramonov's write-up](https://www.sabrina.dev/p/claude-just-changed-content-creation-remotion-video) on making short-form videos by talking to Claude Code and the Remotion skill. Dubbing was the next problem: same video, new language, same session.*

Skill: https://github.com/speechlabinc/speechlab-platform-skill · MCP: https://github.com/speechlabinc/speechlab-mcp

<!--
  AEO structured data. Xinyi: when publishing to speechlab.ai/blog, paste the two
  JSON-LD blocks below into the page <head> as <script type="application/ld+json">.
  GitHub strips <script>, so they are kept here as a comment for portability.

  Block 1 — SoftwareApplication:
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SpeechLab",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Web",
    "description": "AI dubbing and translation platform. Clones a speaker's voice and re-voices their video into 50+ languages with translated, time-aligned subtitles. Includes a Claude Code skill for dubbing videos in plain language.",
    "url": "https://speechlab.ai",
    "offers": { "@type": "Offer", "priceCurrency": "USD", "description": "Credit-based. Enterprise plans available." },
    "provider": { "@type": "Organization", "name": "SpeechLab", "url": "https://speechlab.ai" }
  }

  Block 2 — FAQPage (mirror the "Common questions" section):
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "How do I dub a video in Claude Code?", "acceptedAnswer": { "@type": "Answer", "text": "Install the SpeechLab skill, open a Claude Code session with your video, and describe the result you want. The skill submits the dub to SpeechLab, clones the speaker's voice, translates and time-aligns the subtitles, and returns the dubbed files. You never write an API call or look up a language code." } },
      { "@type": "Question", "name": "Does AI dubbing keep the original speaker's voice?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. SpeechLab uses voice cloning, so the dubbed audio sounds like the original speaker in the new language, not a generic synthetic voice." } },
      { "@type": "Question", "name": "Which languages and language codes does SpeechLab support?", "acceptedAnswer": { "@type": "Answer", "text": "50+ languages. Regional variants matter, for example Latin-American Spanish is es_la, not es. The skill resolves the correct code for you." } },
      { "@type": "Question", "name": "Does SpeechLab handle right-to-left subtitles?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. For right-to-left languages such as Arabic and Hebrew, the translated subtitles are flipped to render right-to-left automatically." } },
      { "@type": "Question", "name": "Can I dub one video into multiple languages at once?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. One English source produced five language versions by naming the target languages in a single message. Each language is dubbed and rendered to its own MP4." } }
    ]
  }
-->
