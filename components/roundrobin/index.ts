/**
 * Barrel for the Stage 5 round-robin components (§6.8). Shared presentational +
 * interactive building blocks for the landing, create flow, public event page,
 * run console, and quiz.
 */

export {
  RR_FORMATS,
  formatMeta,
  formatLabel,
  isRrFormat,
  type RrFormatMeta,
  type RrFormatIcon,
} from "./formats";
export { FormatCard, FormatIcon } from "./FormatCard";
export {
  EntrantsEditor,
  makeDraftEntrant,
  parsePastedNames,
  type DraftEntrant,
} from "./EntrantsEditor";
export { SchedulePreview, estimatePreviewStats, type PreviewStats } from "./SchedulePreview";
export { StandingsTable } from "./StandingsTable";
export { MatchScoreRow } from "./MatchScoreRow";
export { BracketView } from "./BracketView";
export { TvStandings } from "./TvStandings";
