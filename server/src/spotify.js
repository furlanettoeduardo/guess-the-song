import axios from "axios";
import { rateLimit } from "./utils.js";
import { logError } from "./logger.js";

const tokenState = {
  accessToken: null,
  expiresAt: 0,
};

const spotifyApi = axios.create({
  baseURL: "https://api.spotify.com/v1",
  timeout: 10000,
});

async function requestToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("missing spotify client credentials");
  }

  const payload = new URLSearchParams({
    grant_type: "client_credentials",
  });

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    payload,
    {
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  tokenState.accessToken = response.data.access_token;
  tokenState.expiresAt = Date.now() + response.data.expires_in * 1000 - 30000;
}

async function getAccessToken() {
  if (!tokenState.accessToken || Date.now() >= tokenState.expiresAt) {
    await requestToken();
  }
  return tokenState.accessToken;
}

export function extractPlaylistId(url) {
  if (!url) return null;
  const match = url.match(/playlist\/(\w+)/i);
  return match ? match[1] : null;
}

export async function fetchPlaylistTracks(playlistId) {
  const token = await getAccessToken();
  const tracks = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    await rateLimit();
    let response;
    try {
      response = await spotifyApi.get(`/playlists/${playlistId}/tracks`, {
        params: { limit, offset },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      logError("spotify playlist fetch failed", { playlistId, status, data });
      throw error;
    }

    const items = response.data.items || [];
    for (const item of items) {
      const track = item.track;
      if (!track || !track.preview_url) continue;
      tracks.push({
        id: track.id,
        name: track.name,
        artist: track.artists?.map((a) => a.name).join(", ") || "",
        previewUrl: track.preview_url,
      });
    }

    if (!response.data.next) break;
    offset += limit;
  }

  return tracks;
}

export function pickRandomTrack(tracks, lastTrackId) {
  if (!tracks.length) return null;
  const pool = tracks.filter((track) => track.id !== lastTrackId);
  const list = pool.length ? pool : tracks;
  return list[Math.floor(Math.random() * list.length)];
}
