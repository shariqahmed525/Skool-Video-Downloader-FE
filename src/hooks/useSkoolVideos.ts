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
            // Helper 1: Extract Playback ID
            const extractPlaybackId = (bgImage: string, muxPlayer: Element | null) => {
              if (muxPlayer) {
                const pbId = muxPlayer.getAttribute("playback-id");
                if (pbId) return pbId;
              }
              const match = bgImage.match(/image\.video\.skool\.com\/([^\/]+)\//);
              return match ? match[1] : null;
            };

            // Helper 2: Extract Thumbnail URL
            const extractThumbnailUrl = (playbackId: string | null, bgImage: string) => {
              const fullUrlMatch = bgImage.match(/(https:\/\/[^"'\)]+)/);
              if (fullUrlMatch) return fullUrlMatch[1];
              return playbackId ? `https://image.video.skool.com/${playbackId}/thumbnail.png` : "";
            };

            // Helper 3: Collect all possible tokens
            const collectCandidateTokens = (
              playbackId: string | null, 
              muxPlayer: Element | null, 
              bgImage: string, 
              nextDataText: string
            ) => {
              const tokens: string[] = [];
              let targetMux = muxPlayer;
              if (!targetMux && playbackId) {
                targetMux = document.querySelector('mux-player[playback-id="' + playbackId + '"]');
              }

              if (targetMux) {
                const tokensAttr = targetMux.getAttribute("tokens");
                if (tokensAttr) {
                  const pbMatch = tokensAttr.match(/playback=([^,]+)/);
                  if (pbMatch) tokens.push(pbMatch[1]);
                }
                const pbToken = targetMux.getAttribute("playback-token");
                if (pbToken) tokens.push(pbToken);
              }

              const tokenMatchFromBg = bgImage.match(/token=([^&"'\)]+)/);
              if (tokenMatchFromBg) {
                tokens.push(tokenMatchFromBg[1]);
              }

              if (nextDataText) {
                const regex = /"playbackToken":"([^"]+)"/g;
                let match;
                while ((match = regex.exec(nextDataText)) !== null) {
                  tokens.push(match[1]);
                }
              }

              return tokens;
            };

            // Helper 4: Decode JWT
            const decodeJwt = (t: string) => {
              try {
                const base64Url = t.split('.')[1];
                if (!base64Url) return null;
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                return JSON.parse(jsonPayload);
              } catch (e) {
                return null;
              }
            };

            // Helper 5: Find valid token
            const findValidToken = (candidateTokens: string[], playbackId: string | null) => {
              if (!playbackId) return null;
              const now = Math.floor(Date.now() / 1000);
              for (const t of candidateTokens) {
                const decoded = decodeJwt(t);
                if (decoded && decoded.aud === "v" && decoded.sub === playbackId && decoded.exp > now) {
                  return t;
                }
              }
              return null;
            };

            // Helper 6: Extract Title
            const extractTitle = (index: number) => {
              const titleEl = document.querySelector("h2.title") || document.querySelector("h1");
              if (titleEl && titleEl.textContent) {
                return `${titleEl.textContent.trim()} - Part ${index + 1}`;
              }
              return `Video ${index + 1}`;
            };

            try {
              const nextDataEl = document.getElementById("__NEXT_DATA__");
              if (!nextDataEl) {
                return { error: "No __NEXT_DATA__ found on this page. Make sure you are on a Skool lesson." };
              }

              const attachmentElements = document.querySelectorAll(".skool-mux-attachment");
              if (attachmentElements.length === 0) {
                return { error: "No videos found on this page." };
              }

              const foundVideos: any[] = [];
              const nextDataText = nextDataEl.textContent || "";

              attachmentElements.forEach((el, index) => {
                const firstChild = el.firstElementChild;
                const bgImage = firstChild ? window.getComputedStyle(firstChild).backgroundImage : "";
                const muxPlayer = el.querySelector("mux-player");

                const playbackId = extractPlaybackId(bgImage, muxPlayer);
                const thumbnailUrl = extractThumbnailUrl(playbackId, bgImage);
                const candidateTokens = collectCandidateTokens(playbackId, muxPlayer, bgImage, nextDataText);
                const token = findValidToken(candidateTokens, playbackId);

                if (playbackId) {
                  const title = extractTitle(index);
                  foundVideos.push({
                    playbackId,
                    token,
                    title,
                    thumbnailUrl,
                  });
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
