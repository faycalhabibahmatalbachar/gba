'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

type AudioPlayerProps = {
  src: string;
  className?: string;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const STORAGE_KEY = 'gba_audio_playback_speed';

function formatTime(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--:--';
  const sec = Math.max(0, Math.floor(value));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const waveRef = React.useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [speed, setSpeed] = React.useState<number>(1);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [waveform, setWaveform] = React.useState<number[] | null>(null);
  const [decodeFailed, setDecodeFailed] = React.useState(false);

  const progress = duration && duration > 0 ? clamp(currentTime / duration, 0, 1) : 0;

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && SPEEDS.includes(parsed as (typeof SPEEDS)[number])) {
        setSpeed(parsed);
      }
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(speed));
    } catch {
      /* localStorage may be unavailable */
    }
  }, [speed]);

  React.useEffect(() => {
    let cancelled = false;
    let ctx: AudioContext | null = null;

    async function decodeWaveform() {
      setWaveform(null);
      setDecodeFailed(false);
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        ctx = new AudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        if (cancelled) return;

        const channel = audioBuffer.getChannelData(0);
        const bars = 72;
        const step = Math.max(1, Math.floor(channel.length / bars));
        const samples: number[] = [];
        for (let i = 0; i < bars; i += 1) {
          const start = i * step;
          const end = Math.min(channel.length, start + step);
          let sum = 0;
          for (let j = start; j < end; j += 1) sum += Math.abs(channel[j] ?? 0);
          const avg = end > start ? sum / (end - start) : 0;
          samples.push(avg);
        }
        const max = Math.max(...samples, 0.0001);
        setWaveform(samples.map((v) => clamp(v / max, 0.04, 1)));
      } catch {
        if (!cancelled) {
          setDecodeFailed(true);
          setWaveform(null);
        }
      } finally {
        if (ctx) {
          void ctx.close().catch(() => {});
        }
      }
    }

    void decodeWaveform();
    return () => {
      cancelled = true;
      if (ctx) void ctx.close().catch(() => {});
    };
  }, [src]);

  const seekByClientX = React.useCallback((clientX: number, el: HTMLDivElement | null) => {
    const audio = audioRef.current;
    if (!audio || !duration || duration <= 0 || !el) return;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  React.useEffect(() => {
    if (!isScrubbing) return;
    const onMove = (e: MouseEvent) => seekByClientX(e.clientX, barRef.current);
    const onUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isScrubbing, seekByClientX]);

  React.useEffect(() => {
    if (!isScrubbing) return;
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      seekByClientX(t.clientX, barRef.current);
    };
    const onTouchEnd = () => setIsScrubbing(false);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isScrubbing, seekByClientX]);

  return (
    <div className={cn('w-full max-w-[360px] rounded-xl border border-border bg-muted/30 p-2', className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null);
          setIsLoading(false);
        }}
        onCanPlay={() => setIsLoading(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white"
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (isPlaying) {
              void audio.pause();
              return;
            }
            void audio.play();
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoading ? (
              <motion.span key="loading" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} exit={{ opacity: 0.3 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
              </motion.span>
            ) : isPlaying ? (
              <motion.span key="pause" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
                <Pause className="h-4 w-4" />
              </motion.span>
            ) : (
              <motion.span key="play" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
                <Play className="h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="min-w-0 flex-1">
          {waveform && !decodeFailed ? (
            <div
              ref={waveRef}
              className="flex h-8 cursor-pointer items-end gap-[2px]"
              onClick={(e) => seekByClientX(e.clientX, waveRef.current)}
            >
              {waveform.map((amp, idx) => {
                const ratio = waveform.length > 1 ? idx / (waveform.length - 1) : 0;
                const played = ratio <= progress;
                return (
                  <button
                    key={`${idx}-${amp}`}
                    type="button"
                    aria-label="seek waveform"
                    className={cn('w-[3px] rounded-full transition-colors', played ? 'bg-[var(--brand)]' : 'bg-muted-foreground/35')}
                    style={{ height: `${Math.max(10, Math.round(amp * 28))}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekByClientX(e.clientX, waveRef.current);
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="h-8" />
          )}

          <div className="mt-1 flex items-center gap-2">
            <span className="w-9 text-[11px] font-mono text-muted-foreground">{formatTime(currentTime)}</span>
            <div
              ref={barRef}
              className="relative h-2 flex-1 cursor-pointer rounded-full bg-muted"
              onMouseDown={(e) => {
                setIsScrubbing(true);
                seekByClientX(e.clientX, barRef.current);
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (!t) return;
                setIsScrubbing(true);
                seekByClientX(t.clientX, barRef.current);
              }}
              onClick={(e) => seekByClientX(e.clientX, barRef.current)}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand)]" style={{ width: `${progress * 100}%` }} />
              <div
                className={cn(
                  'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--brand)] transition-transform',
                  isScrubbing ? 'scale-125' : 'hover:scale-110',
                )}
                style={{ left: `calc(${progress * 100}% - 6px)` }}
              />
            </div>
            <span className="w-9 text-right text-[11px] font-mono text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          className="h-7 rounded-md border border-border px-2 text-[11px] font-medium"
          onClick={() => {
            const idx = SPEEDS.findIndex((s) => s === speed);
            const next = SPEEDS[(idx + 1) % SPEEDS.length] ?? 1;
            setSpeed(next);
          }}
        >
          {`${speed}×`}
        </button>
      </div>
    </div>
  );
}
