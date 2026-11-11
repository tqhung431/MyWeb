import type { Metadata } from "next";

export const metadata: Metadata = { title: "About · Chill Corner" };

export default function AboutPage() {
  return (
    <div className="prose">
      <h1>About Chill Corner</h1>
      <p>
        Chill Corner is part of <strong>MyWeb</strong>. In Stage 2 it became a <strong>Next.js</strong> app written in{" "}
        <strong>React</strong> and <strong>TypeScript</strong>.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>
          <strong>Server Components</strong> (this page, the Tips pages) are turned into HTML on the server. They send no
          JavaScript.
        </li>
        <li>
          <strong>Client Components</strong> (the sound player and timer) also arrive as HTML, then React makes them
          interactive in the browser.
        </li>
        <li>
          <strong>Routing</strong> comes from folders: <code>app/tips/page.tsx</code> is <code>/tips</code>.
        </li>
      </ul>

      <h2>Credits and licences</h2>
      <ul>
        <li>
          <strong>All sounds</strong> are generated in your browser with the{" "}
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API">Web Audio API</a>. No recorded audio
          is used.
        </li>
        <li>
          <strong>Next.js, React, TypeScript</strong>: MIT / Apache-2.0 licences.
        </li>
        <li>
          <strong>Icons</strong>: Unicode emoji. <strong>Fonts</strong>: your system font.
        </li>
      </ul>
    </div>
  );
}
