import { useState, useEffect } from "react";
import "./App.css";

declare let chrome: any;

interface VideoInfo {
  token: string;
  title: string;
  playbackId: string;
  thumbnailUrl: string;
}

function App() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<
    Record<string, { type: "success" | "error"; text: string }>
  >({});

  useEffect(() => {
    // @ts-ignore - Chrome API might not be fully typed here
    if (!window.chrome || !chrome.tabs) {
      setVideos([]);
      setLoading(false);
      return;
    }

    const scrapeVideos = async () => {
      try {
        // @ts-ignore
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab.id) throw new Error("No active tab");

        if (!tab.url?.includes("skool.com")) {
          setError("Please navigate to a Skool course page.");
          setLoading(false);
          return;
        }

        // @ts-ignore
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const nextDataEl = document.getElementById("__NEXT_DATA__");
              if (!nextDataEl)
                return {
                  error:
                    "No __NEXT_DATA__ found on this page. Make sure you are on a Skool lesson.",
                };

              const attachmentElements = document.querySelectorAll(
                ".skool-mux-attachment",
              );
              if (attachmentElements.length === 0)
                return { error: "No videos found on this page." };

              const foundVideos: any[] = [];

              attachmentElements.forEach((el, index) => {
                let playbackId = null;
                let thumbnailUrl = "";
                const firstChild = el.firstElementChild;
                const bgImage = firstChild
                  ? window.getComputedStyle(firstChild).backgroundImage
                  : "";
                const match = bgImage.match(
                  new RegExp("image\\.video\\.skool\\.com/([^/]+)/"),
                );

                const fullUrlMatch = bgImage.match(/(https:\/\/[^"'\)]+)/);

                if (match) {
                  playbackId = match[1];
                  thumbnailUrl = fullUrlMatch
                    ? fullUrlMatch[1]
                    : `https://image.video.skool.com/${playbackId}/thumbnail.png`;
                } else {
                  const muxPlayer = el.querySelector("mux-player");
                  if (muxPlayer) {
                    playbackId = muxPlayer.getAttribute("playback-id");
                    if (playbackId) {
                      thumbnailUrl = fullUrlMatch
                        ? fullUrlMatch[1]
                        : `https://image.video.skool.com/${playbackId}/thumbnail.png`;
                    }
                  }
                }

                let token = null;
                const tokenMatchFromBg = bgImage.match(/token=([^&"'\)]+)/);
                if (tokenMatchFromBg) {
                  token = tokenMatchFromBg[1];
                }

                if (playbackId) {
                  const regex = new RegExp(
                    `"playbackId":"${playbackId}","playbackToken":"([^"]+)"`,
                  );
                  const tokenMatch = nextDataEl.textContent?.match(regex);

                  if (tokenMatch) {
                    token = tokenMatch[1];
                  }

                  // Try to find the title
                  let title = `Video ${index + 1}`;
                  // Find closest h1/h2 or title element
                  const titleEl =
                    document.querySelector("h2.title") ||
                    document.querySelector("h1");
                  if (titleEl && titleEl.textContent) {
                    title = `${titleEl.textContent.trim()} - Part ${index + 1}`;
                  }

                  if (token) {
                    foundVideos.push({
                      playbackId,
                      token: token,
                      title,
                      thumbnailUrl,
                    });
                  }
                }
              });

              return { videos: foundVideos };
            } catch (err: any) {
              return { error: err.message };
            }
          },
        });

        const data = results[0]?.result;

        if (data?.error) {
          setError(data.error);
        } else if (data?.videos && data.videos.length > 0) {
          setVideos(data.videos);
        } else {
          setError("No downloadable videos found on this page.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to scan page.");
      } finally {
        setLoading(false);
      }
    };

    scrapeVideos();
  }, []);

  const handleDownload = async (video: VideoInfo) => {
    const safeTitle = video.title
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_");

    setDownloadingId(video.playbackId);
    setDownloadStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[video.playbackId];
      return newStatus;
    });
    setError("");

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
        } catch (e) {
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
    } catch (err: any) {
      console.error(err);
      alert(`Download Failed:\n\n${err.message}`);
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

  return (
    <div className="container">
      <header>
        <img
          alt="Skool Logo"
          src="/images/icon128.png"
          style={{ width: "24px", height: "24px", borderRadius: "4px" }}
        />
        <h2>Skool Video Downloader</h2>
      </header>

      <main>
        {loading && (
          <div className="state-container">
            <div className="spinner"></div>
            <p>Scanning Skool for videos...</p>
          </div>
        )}

        {error && (
          <div className="state-container error-state">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="state-container">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="2.18"
                ry="2.18"
              ></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
            <p>No videos found here.</p>
          </div>
        )}

        {!loading && videos.length > 0 && (
          <div className="video-list">
            {videos.map((vid) => (
              <div
                key={vid.playbackId}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  marginBottom: "12px",
                }}
              >
                <div className="video-item" style={{ marginBottom: 0 }}>
                  <div className="video-info">
                    {vid.thumbnailUrl && (
                      <img
                        src={vid.thumbnailUrl}
                        alt="thumbnail"
                        className="video-thumbnail"
                      />
                    )}
                    <div className="video-details">
                      <span className="video-title">{vid.title}</span>
                      <span className="video-id">
                        ID: {vid.playbackId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => handleDownload(vid)}
                    disabled={downloadingId === vid.playbackId}
                    style={{
                      opacity: downloadingId === vid.playbackId ? 0.7 : 1,
                    }}
                    title="Download"
                  >
                    {downloadingId === vid.playbackId ? (
                      <div
                        className="spinner"
                        style={{
                          width: "16px",
                          height: "16px",
                          borderWidth: "2px",
                        }}
                      ></div>
                    ) : downloadStatus[vid.playbackId]?.type === "success" ? (
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
                    ) : downloadStatus[vid.playbackId]?.type === "error" ? (
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
