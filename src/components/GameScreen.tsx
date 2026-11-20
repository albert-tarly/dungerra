import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Game } from "../utils/Game";
import { SessionManager } from "../api/SessionManager";
import { AudioManager } from "../utils/AudioManager";

export const GameScreen: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const gameRef = useRef<Game | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initializingRef = useRef(false);
  const [error, setError] = useState("");
  const volumeRef = useRef<HTMLInputElement | null>(null);

  // Memoize manager instances to prevent re-creation on every render
  const sessionManager = useMemo(() => SessionManager.getInstance(), []);
  const audioManager = useMemo(() => AudioManager.getInstance(), []);
  const [isMuted, setIsMuted] = useState(audioManager.isMuted);
  const [volume, setVolume] = useState(audioManager.getMasterVolume());
  // Mirrors Game's menu flag (Escape); changes only on open and close
  const [menuOpen, setMenuOpen] = useState(false);

  const handleResume = useCallback(() => {
    gameRef.current?.setMenuOpen(false);
  }, []);

  // Unmounting this screen ends the session (see the cleanup effects)
  const handleLeave = useCallback(() => {
    void navigate("/sessions");
  }, [navigate]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      audioManager.setMasterVolume(newVolume);
      setVolume(newVolume);
      if (newVolume === 0) {
        audioManager.mute();
        setIsMuted(true);
      } else {
        if (audioManager.isMuted) {
          audioManager.unmute();
          setIsMuted(false);
        }
      }
      e.target.blur();
    },
    [audioManager],
  );

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        console.log("Stopping game and ending session...");
        sessionManager.endSession();
        gameRef.current.stop();
        gameRef.current = null;
        initializingRef.current = false;
      }

      document.title = "Dungerra";
    };
  }, [sessionManager]);

  useEffect(() => {
    if (!sessionId) {
      void navigate("/sessions");
      return;
    }

    if (
      !gameCanvasRef.current ||
      !lightCanvasRef.current ||
      !uiCanvasRef.current
    ) {
      return;
    }

    // Prevent multiple initializations
    if (initializingRef.current || gameRef.current) {
      return;
    }

    initializingRef.current = true;

    const initGame = async () => {
      try {
        const session = await sessionManager.joinSession(sessionId);
        document.title = `Dungerra - ${session.name}`;

        const game = new Game(
          gameCanvasRef.current!,
          lightCanvasRef.current!,
          uiCanvasRef.current!,
        );
        gameRef.current = game;
        game.onMenuToggle = setMenuOpen;
        game.start(session);
      } catch {
        setError("Failed to join session. Redirecting...");
        setTimeout(() => void navigate("/sessions"), 2000);
      } finally {
        initializingRef.current = false;
      }
    };

    void initGame();

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        console.log("Stopping game and ending session...");
        sessionManager.endSession();
        gameRef.current.stop();
        gameRef.current = null;
        initializingRef.current = false;
      }

      document.title = "Dungerra";
    };
  }, [sessionId, navigate, sessionManager]);

  if (error) {
    return (
      <div className="screen">
        <p className="error">{error}</p>
      </div>
    );
  }

  return (
    <div id="gameScreen" className="screen">
      <canvas ref={gameCanvasRef} className="gameCanvas"></canvas>
      <canvas ref={lightCanvasRef} className="gameCanvas"></canvas>
      <canvas ref={uiCanvasRef} className="gameCanvas"></canvas>
      <div className="volume-control">
        <label
          className="volume-label"
          onClick={() => {
            if (audioManager.isMuted) {
              audioManager.unmute();
              setIsMuted(false);
              if (volumeRef.current) {
                volumeRef.current.value = audioManager
                  .getMasterVolume()
                  .toString();
              }
            } else {
              audioManager.mute();
              setIsMuted(true);
              if (volumeRef.current) {
                volumeRef.current.value = "0";
              }
            }
          }}
        >
          {isMuted ? "🔇" : "🔊"}
        </label>
        <input
          ref={volumeRef}
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          defaultValue={volume}
          onChange={handleVolumeChange}
          className="volume-slider"
          style={
            {
              "--slider-value": `${isMuted ? 0 : volume * 100}%`,
            } as React.CSSProperties
          }
        />
      </div>
      {menuOpen && (
        <div
          className="modal show"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-menu-title"
        >
          <div className="modal-content">
            <h2 id="game-menu-title">Game Menu</h2>
            <p className="game-menu-note">
              The game keeps running while this menu is open.
            </p>
            <div className="modal-buttons">
              <button className="button-secondary" onClick={handleLeave}>
                Leave Game
              </button>
              <button onClick={handleResume} autoFocus>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize component to prevent re-renders from parent
export default React.memo(GameScreen);
