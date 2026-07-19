export interface VideoInfo {
  token: string;
  title: string;
  playbackId: string;
  thumbnailUrl: string;
}

export type DownloadStatus = Record<string, { type: "success" | "error"; text: string }>;
