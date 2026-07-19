/**
 * HLS Downloader
 * 
 * A script to download Demuxed HLS streams (audio and video) and merge them
 * instantly into an MP4 file using FFmpeg, without writing temporary chunks to disk.
 */

import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';


// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  // Headers needed to bypass access restrictions
  headers: {
    'Referer': 'https://www.skool.com/',
    'Origin': 'https://www.skool.com',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
  },
  
  // Directory where the final video will be saved
  outputDir: path.join(os.homedir(), 'Downloads')
};

// ==========================================
// UTILITIES
// ==========================================

/**
 * Fetches a URL with the required security headers.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} The response text.
 */
async function fetchPlaylist(url) {
  const res = await fetch(url, { headers: CONFIG.headers });
  if (!res.ok) {
    throw new Error(`HTTP Error! Status: ${res.status} for URL: ${url}`);
  }
  return res.text();
}

/**
 * Resolves a potentially relative URL against a base URL.
 * @param {string} baseUrl - The base URL (usually the playlist URL).
 * @param {string} relativeUrl - The URL found in the playlist.
 * @returns {string} The fully qualified URL.
 */
function resolveUrl(baseUrl, relativeUrl) {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    return relativeUrl;
  }
}

/**
 * Parses a Master M3U8 playlist to find the best video and audio streams.
 * @param {string} masterText - The raw text of the master playlist.
 * @param {string} baseUrl - The URL of the master playlist for resolving relative links.
 * @returns {{videoUrl: string|null, audioUrl: string|null}}
 */
function parseMasterPlaylist(masterText, baseUrl) {
  const lines = masterText.split('\n');
  let videoUrl = null;
  let audioUrl = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Find Audio Stream
    if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO') && !audioUrl) {
      const match = line.match(/URI="([^"]+)"/);
      if (match && match[1]) {
        audioUrl = resolveUrl(baseUrl, match[1]);
      }
    }
    
    // Find Best Video Stream (assumes the first one is highest quality)
    if (line.startsWith('#EXT-X-STREAM-INF') && !videoUrl) {
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === '' || lines[j].startsWith('#'))) {
        j++;
      }
      if (j < lines.length) {
        videoUrl = resolveUrl(baseUrl, lines[j].trim());
      }
    }
  }

  return { videoUrl, audioUrl };
}

/**
 * Streams and merges the media using FFmpeg.
 * @param {string} videoUrl - The video playlist URL.
 * @param {string|null} audioUrl - The audio playlist URL (if separated).
 * @param {string} outputPath - The final save location.
 */
function mergeWithFFmpeg(videoUrl, audioUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-headers', `Referer: ${CONFIG.headers.Referer}\r\n`,
      '-i', videoUrl
    ];

    if (audioUrl) {
      ffmpegArgs.push(
        '-headers', `Referer: ${CONFIG.headers.Referer}\r\n`,
        '-i', audioUrl
      );
    }

    // Direct copy without re-encoding
    ffmpegArgs.push('-c', 'copy', '-y', outputPath);

    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    // Track progress by listening to stderr
    ffmpegProcess.stderr.on('data', (data) => {
      const out = data.toString();
      const timeMatch = out.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      if (timeMatch) {
        process.stdout.write(`\r[FFmpeg] Progress: ${timeMatch[1]} `);
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

// ==========================================
// MAIN EXECUTION
// ==========================================

async function main() {
  try {
    // 1. Determine Output File Name and Arguments
    const playbackId = process.argv[2];
    const token = process.argv[3];
    const customName = process.argv[4];

    if (!playbackId || !token) {
      console.error("❌ Usage: node download-video.js <playbackId> <token> [optional_output_name]");
      process.exit(1);
    }

    const masterUrl = `https://stream.video.skool.com/${playbackId}.m3u8?token=${token}`;

    let safeName = customName || playbackId;
    safeName = safeName.replace(/[^a-z0-9_-]/gi, '_');

    const fileName = safeName.endsWith('.mp4') ? safeName : `${safeName}.mp4`;
      
    const finalFile = path.join(CONFIG.outputDir, fileName);

    // 2. Fetch and Parse Playlist
    console.log("📥 Fetching master playlist...");
    const masterText = await fetchPlaylist(masterUrl);
    const { videoUrl, audioUrl } = parseMasterPlaylist(masterText, masterUrl);

    if (!videoUrl) {
      throw new Error("Could not find a valid video stream in the master playlist.");
    }

    console.log(`🎬 Target output: ${finalFile}`);
    console.log("🚀 Instructing FFmpeg to stream and merge directly...\n");

    // 3. Download and Merge
    await mergeWithFFmpeg(videoUrl, audioUrl, finalFile);
    console.log(`\n\n✅ Success! Video downloaded directly to: ${finalFile}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Start the script
main();
