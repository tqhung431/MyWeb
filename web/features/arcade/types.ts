// What every game gets from the game page (GameShell).
export type GameProps = {
  /** Call once when the game ends, with the final score. */
  onFinish: (score: number) => void;
};
