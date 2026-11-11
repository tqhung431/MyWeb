// Home page ("/"). A Server Component: the heading is plain HTML from the server,
// and the two cards are Client Components that become interactive in the browser.

import { FocusTimer } from "@/components/FocusTimer";
import { SoundPlayer } from "@/components/SoundPlayer";

export default function HomePage() {
  return (
    <>
      <section className="intro">
        <h1>Take a breath.</h1>
        <p>Pick a sound, start the timer, and focus on one thing.</p>
      </section>

      <div className="cards">
        <SoundPlayer />
        <FocusTimer />
      </div>
    </>
  );
}
