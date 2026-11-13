// Stage 22: runs Nook's chess thinking off the main thread. Message in: {id, fen, level}; out: {id, move}.
import { bestMove, type Level } from "./engine";

self.onmessage = (e: MessageEvent<{ id: number; fen: string; level: Level }>) => {
  const { id, fen, level } = e.data;
  const move = bestMove(fen, level);
  self.postMessage({ id, move });
};
