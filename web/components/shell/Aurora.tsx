// Soft colour glows behind everything. Decorative only.
//
// Stage 19 (speed): these used to be three huge blurred circles drifting forever. Every frame, the browser had to
// re-blur them AND every frosted-glass card above them (backdrop-blur), which kept phones busy (Lighthouse: seconds
// of main-thread work). Now they are still radial gradients: the same soft look, painted once.

const glow = (color: string) => ({ background: `radial-gradient(closest-side, var(${color}), transparent)` });

export function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-56 -left-48 h-[44rem] w-[44rem] opacity-60" style={glow("--glow-1")} />
      <div className="absolute top-1/4 -right-56 h-[40rem] w-[40rem] opacity-50" style={glow("--glow-2")} />
      <div className="absolute -bottom-64 left-1/5 h-[38rem] w-[38rem] opacity-50" style={glow("--glow-3")} />
    </div>
  );
}
