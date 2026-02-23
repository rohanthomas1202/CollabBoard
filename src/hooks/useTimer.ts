"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export interface TimerState {
  status: "idle" | "running" | "paused";
  durationMs: number;
  startedAt: number | null; // server timestamp when started
  remainingMs: number; // saved when paused
  startedBy: string;
}

const DEFAULT_STATE: TimerState = {
  status: "idle",
  durationMs: 300_000, // 5 min default
  startedAt: null,
  remainingMs: 300_000,
  startedBy: "",
};

const PRESETS = [60_000, 180_000, 300_000, 600_000]; // 1, 3, 5, 10 min

export { PRESETS as TIMER_PRESETS };

export function useTimer(boardId: string, userId: string) {
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_STATE);
  const [displayMs, setDisplayMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Listen to RTDB timer state
  useEffect(() => {
    if (!boardId) return;
    const timerRef = ref(rtdb, `timers/${boardId}`);
    const unsub = onValue(timerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTimerState(data as TimerState);
      } else {
        setTimerState(DEFAULT_STATE);
      }
    });
    return () => unsub();
  }, [boardId]);

  // Local tick: compute remaining from startedAt
  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (timerState.status === "running" && timerState.startedAt) {
      const tick = () => {
        const elapsed = Date.now() - timerState.startedAt!;
        const remaining = Math.max(0, timerState.remainingMs - elapsed);
        setDisplayMs(remaining);
        if (remaining === 0) {
          setFinished(true);
        }
      };
      tick();
      tickRef.current = setInterval(tick, 200);
    } else if (timerState.status === "paused") {
      setDisplayMs(timerState.remainingMs);
      setFinished(false);
    } else {
      setDisplayMs(timerState.durationMs);
      setFinished(false);
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [timerState]);

  // Play sound when finished
  useEffect(() => {
    if (!finished) return;
    try {
      // Use Web Audio API for a simple beep
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      audioRef.current = null;
    } catch {
      // Audio may be blocked
    }
  }, [finished]);

  const writeState = useCallback(
    (state: TimerState) => {
      const timerRef = ref(rtdb, `timers/${boardId}`);
      set(timerRef, state);
    },
    [boardId]
  );

  const start = useCallback(
    (durationMs?: number) => {
      const dur = durationMs || timerState.durationMs;
      writeState({
        status: "running",
        durationMs: dur,
        startedAt: Date.now(),
        remainingMs: dur,
        startedBy: userId,
      });
      setFinished(false);
    },
    [timerState.durationMs, userId, writeState]
  );

  const resume = useCallback(() => {
    if (timerState.status !== "paused") return;
    writeState({
      ...timerState,
      status: "running",
      startedAt: Date.now(),
    });
    setFinished(false);
  }, [timerState, writeState]);

  const pause = useCallback(() => {
    if (timerState.status !== "running" || !timerState.startedAt) return;
    const elapsed = Date.now() - timerState.startedAt;
    const remaining = Math.max(0, timerState.remainingMs - elapsed);
    writeState({
      ...timerState,
      status: "paused",
      startedAt: null,
      remainingMs: remaining,
    });
  }, [timerState, writeState]);

  const reset = useCallback(() => {
    writeState(DEFAULT_STATE);
    setFinished(false);
  }, [writeState]);

  return {
    status: timerState.status,
    displayMs,
    finished,
    start,
    resume,
    pause,
    reset,
  };
}
