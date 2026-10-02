import { useState } from "react";

/** A minimal stateful component. Replace with the app's real UI. */
export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      count is {count}
    </button>
  );
}
