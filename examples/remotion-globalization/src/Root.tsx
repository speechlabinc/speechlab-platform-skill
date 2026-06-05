/**
 * Root.tsx — Remotion composition registry
 *
 * Registers the "Main" composition with:
 *   - A Zod schema so Remotion Studio can render any language interactively
 *   - calculateMetadata that fetches localization (audio + captions) for the
 *     requested language and sets durationInFrames from the audio duration
 *   - 1080 × 1920 (vertical 9:16), 30 fps
 *
 * Language prop flow:
 *   `npx remotion render src/Root.tsx Main --props='{"language":"es_la"}'`
 *     → calculateMetadata loads public/es_la/captions.srt
 *     → sets durationInFrames and merges audioSrc + captions into props
 *     → passes full resolved props to MainComposition
 *
 * SpeechLab endpoints (used in scripts/fetch-localization.mjs, cached to public/):
 *   POST /auth/login                      → tokens.accessToken.jwtToken
 *   POST /projects/createProjectAndDub    → { projectId, jobId, dubStatus }
 *   Poll GET /projects                    → translations[0].dub[0].status === 'COMPLETE'
 *   GET  /medias/getMediaPresignedURL?projectId=<id>  → raw presigned URL
 */

import React from "react";
import { Composition, registerRoot } from "remotion";
import { z } from "zod";
import type { CalculateMetadataFunction } from "remotion";
import { MainComposition, mainSchema } from "./Main";
import { loadLocalization } from "./speechlab";
import type { Language } from "./types";

/** The schema only describes the *input* props — language is all the user sets */
export const compositionSchema = z.object({
  language: mainSchema.shape.language,
});

type CompositionInputProps = z.infer<typeof mainSchema>;

const FPS = 30;

/**
 * calculateMetadata — runs before every render.
 *
 * Receives {language} from --props / Studio UI.
 * Calls loadLocalization() → reads public/<lang>/captions.srt (already fetched).
 * Returns durationInFrames + merged props (audioSrc, captions, durationSec).
 */
const calculateMetadata: CalculateMetadataFunction<CompositionInputProps> =
  async ({ props }) => {
    const language = props.language as Language;
    const localization = await loadLocalization(language);

    const durationInFrames = Math.ceil(localization.durationSec * FPS);

    return {
      durationInFrames: durationInFrames > 0 ? durationInFrames : FPS * 30,
      props: {
        language,
        audioSrc: localization.audioSrc,
        captions: localization.captions,
        durationSec: localization.durationSec,
      },
    };
  };

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={MainComposition}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS * 30}
      schema={mainSchema}
      defaultProps={{
        language: "en" as Language,
        audioSrc: "",
        captions: [],
        durationSec: 0,
      }}
      calculateMetadata={calculateMetadata}
    />
  );
};

registerRoot(RemotionRoot);
