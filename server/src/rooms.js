import { generateRoomId } from "./utils.js";

const rooms = new Map();

export function createRoom({ playlistId, tracks, hostName }) {
  const id = generateRoomId();
  const room = {
    id,
    playlistId,
    tracks,
    players: [{ id: "host", name: hostName }],
    currentTrack: null,
    status: "idle",
    scores: {},
    roundStartedAt: null,
  };
  rooms.set(id, room);
  return room;
}

export function getRoom(id) {
  return rooms.get(id);
}

export function joinRoom(id, player) {
  const room = rooms.get(id);
  if (!room) return null;
  if (!room.players.find((p) => p.id === player.id)) {
    room.players.push(player);
    room.scores[player.id] = room.scores[player.id] || 0;
  }
  return room;
}

export function removePlayer(id, playerId) {
  const room = rooms.get(id);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== playerId);
  delete room.scores[playerId];
}

export function setCurrentTrack(id, track) {
  const room = rooms.get(id);
  if (!room) return;
  room.currentTrack = track;
  room.status = "playing";
}

export function markRoundStart(id) {
  const room = rooms.get(id);
  if (!room) return;
  room.roundStartedAt = Date.now();
}

export function addScore(id, playerId, points) {
  const room = rooms.get(id);
  if (!room) return;
  room.scores[playerId] = (room.scores[playerId] || 0) + points;
}

export function clearRound(id) {
  const room = rooms.get(id);
  if (!room) return;
  room.currentTrack = null;
  room.status = "idle";
  room.roundStartedAt = null;
}
