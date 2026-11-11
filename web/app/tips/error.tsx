"use client"; // error pages must be client components (they get a reset button)

// Shown instead of the Tips pages when loading them throws, e.g. the API is down.
// The header, footer and running timer stay on screen.

export default function TipsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="prose">
      <h1>Tips are resting</h1>
      <p className="hint">We couldn&apos;t reach the API. Is it running? (cd api &amp;&amp; npm run dev)</p>
      <div className="controls" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
