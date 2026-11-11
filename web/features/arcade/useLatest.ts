import { useEffect, useRef } from "react";

// A ref that always holds the newest value, for game loops that start once
// but must call the latest callback (e.g. onFinish).
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
