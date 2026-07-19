import type { VideoInfo, DownloadStatus } from "../types";

interface VideoItemProps {
  video: VideoInfo;
  onDownload: (video: VideoInfo) => void;
  downloadingId: string | null;
  downloadStatus: DownloadStatus;
}

export function VideoItem({
  video,
  onDownload,
  downloadingId,
  downloadStatus,
}: VideoItemProps) {
  const isDownloading = downloadingId === video.playbackId;
  const status = downloadStatus[video.playbackId];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        marginBottom: "12px",
      }}
    >
      <div className="video-item" style={{ marginBottom: 0 }}>
        <div className="video-info">
          {video.thumbnailUrl && (
            <img
              src={video.thumbnailUrl}
              alt="thumbnail"
              className="video-thumbnail"
            />
          )}
          <div className="video-details">
            <span className="video-title">{video.title}</span>
            <span className="video-id">
              ID: {video.playbackId.substring(0, 8)}...
            </span>
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={() => onDownload(video)}
          disabled={isDownloading}
          style={{
            opacity: isDownloading ? 0.7 : 1,
          }}
          title="Download"
        >
          {isDownloading ? (
            <div
              className="spinner"
              style={{
                width: "16px",
                height: "16px",
                borderWidth: "2px",
              }}
            ></div>
          ) : status?.type === "success" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3fb950"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : status?.type === "error" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f85149"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
