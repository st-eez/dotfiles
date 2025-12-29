import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delayMs: number): T {
  // Use arrow function form to handle function-valued T correctly
  // (prevents React from treating functions as lazy initializers)
  const [debouncedValue, setDebouncedValue] = useState<T>(() => value);

  useEffect(() => {
    // Skip debounce for zero/negative delays
    if (delayMs <= 0) {
      setDebouncedValue(() => value);
      return;
    }
    const timer = setTimeout(() => setDebouncedValue(() => value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
