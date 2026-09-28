import { useEffect, useState } from 'react'

/** The current time, re-rendering every `intervalMs` ("Updated 2 min ago", "Happening now"). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
