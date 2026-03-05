import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import {
  createRoom,
  getRoom,
  joinRoom,
  removePlayer,
  setCurrentTrack,
  addScore,
  markRoundStart,
  clearRound,
} from "./rooms.js";
import {
  extractPlaylistId,
  fetchPlaylistTracks,
  pickRandomTrack,
} from "./spotify.js";
import { normalizeText, similarityPercent, rateLimit } from "./utils.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/rooms", rateLimit, async (req, res) => {
  const { playlistUrl, hostName } = req.body || {};
  if (!playlistUrl || !hostName) {
    return res.status(400).json({ error: "playlistUrl and hostName required" });
  }

  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    return res.status(400).json({ error: "invalid playlistUrl" });
  }

  try {
    const tracks = await fetchPlaylistTracks(playlistId);
    if (!tracks.length) {
      return res.status(400).json({ error: "playlist has no previewable tracks" });
    }

    const room = createRoom({ playlistId, tracks, hostName });
    return res.json({ roomId: room.id });
  } catch (error) {
    return res.status(500).json({ error: "failed to load playlist" });
  }
});

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, name }) => {
    const room = joinRoom(roomId, { id: socket.id, name });
    if (!room) {
      socket.emit("room:error", { message: "room not found" });
      return;
    }

    socket.join(roomId);
    io.to(roomId).emit("room:state", room);
  });

  socket.on("room:leave", ({ roomId }) => {
    removePlayer(roomId, socket.id);
    socket.leave(roomId);
    const room = getRoom(roomId);
    if (room) {
      io.to(roomId).emit("room:state", room);
    }
  });

  socket.on("round:start", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.status === "playing") return;

    const track = pickRandomTrack(room.tracks, room.currentTrack?.id);
    if (!track) return;

    setCurrentTrack(roomId, track);
    markRoundStart(roomId);

    io.to(roomId).emit("round:started", {
      trackId: track.id,
      previewUrl: track.previewUrl,
    });
  });

  socket.on("round:guess", ({ roomId, guess }) => {
    const room = getRoom(roomId);
    if (!room || !room.currentTrack || room.status !== "playing") return;

    const normalizedGuess = normalizeText(guess);
    const normalizedTitle = normalizeText(room.currentTrack.name);
    const score = similarityPercent(normalizedGuess, normalizedTitle);

    if (score >= 80) {
      const elapsedSeconds = (Date.now() - room.roundStartedAt) / 1000;
      const points = Math.max(5, Math.round(100 - elapsedSeconds * 5));
      addScore(roomId, socket.id, points);

      io.to(roomId).emit("round:ended", {
        winnerId: socket.id,
        answer: room.currentTrack.name,
        points,
      });

      clearRound(roomId);
      io.to(roomId).emit("room:state", getRoom(roomId));
    }
  });

  socket.on("disconnect", () => {
    for (const room of io.sockets.adapter.rooms.keys()) {
      if (room === socket.id) continue;
      removePlayer(room, socket.id);
      const updated = getRoom(room);
      if (updated) {
        io.to(room).emit("room:state", updated);
      }
    }
  });
});

const port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log(`server listening on ${port}`);
});
