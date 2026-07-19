import { useState, useEffect } from "react";
import type { VideoInfo } from "../types";

declare let chrome: any;

export function useSkoolVideos() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return { videos, loading, error };
}
