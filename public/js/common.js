(function () {
  async function getState() {
    const response = await fetch("/api/state");
    if (!response.ok) {
      throw new Error("Failed to load app state.");
    }
    return response.json();
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds || 0));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s`;
  }

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    return {
      error: text.includes("Internal Server Error") ? "Server failed to process the request." : text,
    };
  }

  async function uploadVideo(file) {
    const formData = new FormData();
    formData.append("video", file);
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }
    return data;
  }

  async function startPlayback() {
    const response = await fetch("/api/playback/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error("Failed to start playback.");
    }
    return response.json();
  }

  async function tickPlayback(playbackSeconds, watchSeconds) {
    const response = await fetch("/api/analytics/tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playbackSeconds, watchSeconds }),
    });
    if (!response.ok) {
      throw new Error("Failed to update playback analytics.");
    }
    return response.json();
  }

  async function incrementViews(count) {
    const response = await fetch("/api/analytics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    if (!response.ok) {
      throw new Error("Failed to update views.");
    }
    return response.json();
  }

  function renderVideo(container, state, emptyText) {
    if (!container) return;
    if (state.currentVideo?.path) {
      container.innerHTML = `<video id="${container.dataset.videoId || ""}" src="${state.currentVideo.path}" playsinline preload="auto" muted></video>`;
    } else {
      container.innerHTML = `<div class="empty">${emptyText}</div>`;
    }
  }

  function setMessage(id, type, text) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = text ? `<div class="flash ${type}">${text}</div>` : "";
  }

  window.CabMediaApp = {
    formatDuration,
    getState,
    incrementViews,
    renderVideo,
    setMessage,
    startPlayback,
    tickPlayback,
    uploadVideo,
  };
})();
