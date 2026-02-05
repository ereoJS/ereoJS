'use client';

import { useState } from 'react';

interface CounterProps {
  initialCount?: number;
}

/**
 * Interactive counter component.
 * This demonstrates client-side interactivity with EreoJS's islands architecture.
 * The 'use client' directive marks this component for hydration.
 */
export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => setCount((c) => c - 1)}
        className="btn btn-secondary w-10 h-10 flex items-center justify-center text-xl"
        aria-label="Decrease count"
      >
        -
      </button>
      <span className="text-2xl font-bold w-12 text-center">{count}</span>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="btn btn-primary w-10 h-10 flex items-center justify-center text-xl"
        aria-label="Increase count"
      >
        +
      </button>
    </div>
  );
}