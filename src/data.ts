import content from "../content/episodes.json" with { type: "json" };

export interface EpisodeSource {
  label: string;
  url: string;
}

export interface EpisodeRecord {
  id: string;
  number: number;
  title: string;
  column: string;
  pubDate: string;
  duration: string;
  durationSeconds: number | null;
  audio: string;
  cover: string | null;
  summary: string;
  chapters: string[];
  sources: EpisodeSource[];
  music: string | null;
}

export const show = content.show;
export const records: EpisodeRecord[] = content.episodes;
export const categories = ["全部节目", ...content.categories];
export const archiveColumns = content.columns;

export function columnFiles(lane: number) {
  return records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.column === archiveColumns[lane])
    .map(({ index }) => index);
}
export function fileLocation(index: number) {
  const lane = archiveColumns.indexOf(records[index].column);
  const row = 12 + columnFiles(lane).indexOf(index);
  return { lane, row, slot: lane * 32 + row };
}
export function fileAtSlot(slot: number) {
  const files = columnFiles(Math.floor(slot / 32));
  return files[Math.max(0, Math.min(files.length - 1, (slot % 32) - 12))];
}
