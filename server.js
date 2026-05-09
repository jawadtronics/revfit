const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isVercelRuntime = Boolean(process.env.VERCEL);
const uploadsDir = isVercelRuntime ? path.join("/tmp", "bucket") : path.join(__dirname, "public", "bucket");
const dataDir = isVercelRuntime ? path.join("/tmp", "data") : path.join(__dirname, "data");
const stateFile = path.join(dataDir, "app-state.json");

const defaultState = {
  currentVideo: null,
  analytics: {
    playbackSeconds: 0,
    watchSeconds: 0,
    views: 0,
    earnings: 0,
  },
  logs: [],
};

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

function readState() {
  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2));
    return { ...defaultState };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const nextState = {
      ...defaultState,
      ...parsed,
      analytics: {
        ...defaultState.analytics,
        ...(parsed.analytics || {}),
      },
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
    if (nextState.currentVideo?.path) {
      const diskPath = path.join(__dirname, "public", nextState.currentVideo.path.replace(/^\//, ""));
      if (!fs.existsSync(diskPath)) {
        nextState.currentVideo = null;
      }
    }
    return nextState;
  } catch {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2));
    return { ...defaultState };
  }
}

function writeState(nextState) {
  fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2));
}

function pushLog(state, message) {
  state.logs = [
    {
      message,
      at: new Date().toISOString(),
    },
    ...(state.logs || []),
  ].slice(0, 25);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 48) || "campaign";
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/bucket", express.static(uploadsDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/state", (_req, res) => {
  const state = readState();
  res.json(state);
});

app.post("/api/playback/start", (_req, res) => {
  const state = readState();
  pushLog(state, "Screen playback started.");
  writeState(state);
  res.json(state);
});

app.post("/api/analytics/tick", (req, res) => {
  const state = readState();
  const playbackSeconds = Math.max(0, Number(req.body?.playbackSeconds || 0));
  const watchSeconds = Math.max(0, Number(req.body?.watchSeconds || 0));
  state.analytics.playbackSeconds += playbackSeconds;
  state.analytics.watchSeconds += watchSeconds;
  state.analytics.earnings = Math.floor(state.analytics.playbackSeconds / 60);
  writeState(state);
  res.json(state);
});

app.post("/api/analytics/view", (req, res) => {
  const state = readState();
  const count = Math.max(0, Number(req.body?.count || 0));
  state.analytics.views += count;
  if (count > 0) {
    pushLog(state, `Registered ${count} new view${count === 1 ? "" : "s"}.`);
  }
  writeState(state);
  res.json(state);
});

app.post("/api/reset", (_req, res) => {
  writeState({ ...defaultState });
  res.json(readState());
});

app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No video file uploaded." });
    return;
  }

  const state = readState();
  state.currentVideo = {
    path: `/bucket/${req.file.filename}`,
    mimeType: req.file.mimetype || "video/mp4",
    originalName: req.file.originalname,
    uploadedAt: new Date().toISOString(),
  };
  state.analytics = {
    playbackSeconds: 0,
    watchSeconds: 0,
    views: 0,
    earnings: 0,
  };
  pushLog(state, `Uploaded video: ${req.file.originalname}`);
  writeState(state);

  res.json(state);
});

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`ScopeNow cabin ads app running on http://localhost:${PORT}`);
});
