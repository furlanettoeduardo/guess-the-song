import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [state, setState] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [guess, setGuess] = useState("");

  useEffect(() => {
    socket.on("room:state", (data) => {
      setState(data);
      setStatus(data.status);
    });

    socket.on("round:started", ({ previewUrl: url }) => {
      setPreviewUrl(url);
      setStatus("playing");
    });

    socket.on("round:ended", () => {
      setPreviewUrl(null);
      setGuess("");
      setStatus("idle");
    });

    return () => {
      socket.off("room:state");
      socket.off("round:started");
      socket.off("round:ended");
    };
  }, []);

  const isHost = useMemo(() => state?.players?.some((p) => p.id === "host"), [
    state,
  ]);

  async function createRoom() {
    const response = await fetch("http://localhost:4000/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistUrl, hostName: name || "Host" }),
    });

    const data = await response.json();
    if (data.roomId) {
      setRoomId(data.roomId);
      socket.emit("room:join", { roomId: data.roomId, name: name || "Host" });
    }
  }

  function joinRoom() {
    socket.emit("room:join", { roomId, name: name || "Player" });
  }

  function startRound() {
    socket.emit("round:start", { roomId });
  }

  function sendGuess() {
    if (!guess.trim()) return;
    socket.emit("round:guess", { roomId, guess });
  }

  return (
    <div className="app">
      <header>
        <h1>Guess the Song</h1>
        <p>Multiplayer com preview de 30 segundos do Spotify.</p>
      </header>

      <section className="card">
        <h2>Entrar ou criar sala</h2>
        <input
          placeholder="Seu nome"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          placeholder="Link da playlist"
          value={playlistUrl}
          onChange={(event) => setPlaylistUrl(event.target.value)}
        />
        <button onClick={createRoom}>Criar sala</button>

        <div className="divider" />

        <input
          placeholder="Codigo da sala"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value.toUpperCase())}
        />
        <button onClick={joinRoom}>Entrar na sala</button>
      </section>

      {state && (
        <section className="card">
          <h2>Sala {state.id}</h2>
          <p>Status: {status}</p>
          <p>
            Jogadores: {state.players.map((player) => player.name).join(", ")}
          </p>

          {isHost && (
            <button onClick={startRound} disabled={status === "playing"}>
              Iniciar rodada
            </button>
          )}

          {previewUrl && (
            <audio src={previewUrl} autoPlay controls preload="auto" />
          )}

          <div className="guess">
            <input
              placeholder="Digite sua resposta"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              disabled={status !== "playing"}
            />
            <button onClick={sendGuess} disabled={status !== "playing"}>
              Enviar
            </button>
          </div>

          <div className="scores">
            <h3>Placar</h3>
            <ul>
              {Object.entries(state.scores).map(([playerId, score]) => {
                const player = state.players.find((p) => p.id === playerId);
                return (
                  <li key={playerId}>
                    {player?.name || "Player"}: {score}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
