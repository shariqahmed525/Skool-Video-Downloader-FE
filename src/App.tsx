import "./App.css";
import { useSkoolVideos } from "./hooks/useSkoolVideos";
import { useVideoDownload } from "./hooks/useVideoDownload";
import { StateContainer } from "./components/StateContainer";
import { VideoItem } from "./components/VideoItem";

function App() {
  const { videos, loading, error } = useSkoolVideos();
  const { handleDownload, downloadingId, downloadStatus } = useVideoDownload();

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
          <StateContainer
            type="loading"
            message="Scanning Skool for videos..."
          />
        )}

        {error && <StateContainer type="error" message={error} />}

        {!loading && !error && videos.length === 0 && (
          <StateContainer type="empty" message="No videos found here." />
        )}

        {!loading && videos.length > 0 && (
          <div className="video-list">
            {videos.map((vid) => (
              <VideoItem
                key={vid.playbackId}
                video={vid}
                onDownload={handleDownload}
                downloadingId={downloadingId}
                downloadStatus={downloadStatus}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
