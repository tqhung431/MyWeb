// Soft, slowly drifting colour blobs behind everything. Decorative only.

export function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] animate-float rounded-full bg-glow-1 opacity-50 blur-3xl" />
      <div
        className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] animate-float rounded-full bg-glow-2 opacity-40 blur-3xl"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="absolute -bottom-48 left-1/4 h-[28rem] w-[28rem] animate-float rounded-full bg-glow-3 opacity-40 blur-3xl"
        style={{ animationDelay: "-14s" }}
      />
    </div>
  );
}
