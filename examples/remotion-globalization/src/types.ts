import type { Caption } from "@remotion/captions";

/**
 * The set of languages this example supports.
 *
 * Each value maps directly to a SpeechLab locale code accepted by
 * POST /projects/createProjectAndDub (except 'en' which is the source).
 *
 * SpeechLab accepted locale enum (partial list):
 *   es_la  – Spanish (Latin America)
 *   es_es  – Spanish (Spain)
 *   fr     – French
 *   fr_ca  – French (Canada)
 *   pt_br  – Portuguese (Brazil)
 *   pt_pt  – Portuguese (Portugal)
 *   ar_sa  – Arabic (Saudi Arabia)
 */
export type Language = "en" | "es_la" | "fr" | "pt_br";

/**
 * The resolved localization data consumed by Main.tsx at render time.
 *
 * audioSrc:    Absolute URL or staticFile() path for the dubbed audio track.
 * captions:    Parsed Caption objects (from @remotion/captions parseSrt).
 * durationSec: Total audio duration in seconds; drives calculateMetadata.
 */
export interface LocalizationData {
  audioSrc: string;
  captions: Caption[];
  durationSec: number;
}
