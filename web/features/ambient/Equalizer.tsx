// Four bouncing bars that say "this is playing". Pure CSS animation.

const DELAYS = ["0s", "-0.35s", "-0.6s", "-0.2s"];

export function Equalizer() {
  return (
    <span aria-hidden="true" className="inline-flex h-4 items-end gap-[3px]">
      {DELAYS.map((delay) => (
        <span
          key={delay}
          className="h-full w-[3px] origin-bottom animate-eq rounded-full bg-current"
          style={{ animationDelay: delay }}
        />
      ))}
    </span>
  );
}
