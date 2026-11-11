import Link from "next/link";

export default function NotFound() {
  return (
    <div className="prose" style={{ textAlign: "center" }}>
      <h1>Nothing here</h1>
      <p className="hint">This page drifted away.</p>
      <p>
        <Link href="/">Back to Chill Corner</Link>
      </p>
    </div>
  );
}
