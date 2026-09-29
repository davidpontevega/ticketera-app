import { useEffect, useState } from "react";

export interface Countdown {
  secondsLeft: number;
  isExpired: boolean;
  label: string; // "MM:SS"
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Cuenta regresiva en segundos desde que el componente monta. Se detiene en 0.
export function useCountdown(totalSeconds: number): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const isExpired = secondsLeft <= 0;

  useEffect(() => {
    if (isExpired) return;
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isExpired]);

  return { secondsLeft, isExpired, label: formatSeconds(secondsLeft) };
}
