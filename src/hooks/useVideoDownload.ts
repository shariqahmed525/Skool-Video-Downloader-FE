import { useState } from "react";
import type { VideoInfo, DownloadStatus } from "../types";

export function useVideoDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({});

  const handleDownload = async (video: VideoInfo) => {
    const timestamp = Date.now();
    const randomChars = Math.random().toString(36).substring(2, 8);
    const safeTitle = video.title
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_") + `_${timestamp}_${randomChars}`;

    setDownloadingId(video.playbackId);
    setDownloadStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[video.playbackId];
      return newStatus;
    });

    try {
      // 1. Tell backend to process the video. This takes time, and the loader will spin.
      const response = await fetch("https://skool-video-downloader-be.onrender.com/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playbackId: video.playbackId,
          token: video.token,
          title: safeTitle,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Backend error: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (data.success && data.fileName) {
        // 2. The backend has finished processing. Now trigger the native browser download!
        const url = new URL("https://skool-video-downloader-be.onrender.com/serve-file");
        url.searchParams.append("fileName", data.fileName);

        const a = document.createElement("a");
        a.href = url.toString();
        a.download = data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setDownloadStatus((prev) => ({
          ...prev,
          [video.playbackId]: {
            type: "success",
            text: "",
          },
        }));

        setTimeout(() => {
          setDownloadStatus((prev) => {
            const newStatus = { ...prev };
            delete newStatus[video.playbackId];
            return newStatus;
          });
        }, 2000);
      } else {
        throw new Error(data.error || "Unexpected response from backend.");
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Download Failed:\n\n${errorMessage}`);
      setDownloadStatus((prev) => ({
        ...prev,
        [video.playbackId]: {
          type: "error",
          text: "",
        },
      }));

      setTimeout(() => {
        setDownloadStatus((prev) => {
          const newStatus = { ...prev };
          delete newStatus[video.playbackId];
          return newStatus;
        });
      }, 2000);
    } finally {
      setDownloadingId(null);
    }
  };

  return { handleDownload, downloadingId, downloadStatus };
}
