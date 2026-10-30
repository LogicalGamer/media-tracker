import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MEASURE_FONT_SIZE, measureGlyph, type GlyphBox } from "@/lib/glyph-metrics";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

// Geometry (in SVG units) borrowed from the reference "FIRE" animation:
// each letter is a column split into 3 stacked copies separated by a gap.
// The top and bottom copies trade height (LARGE <-> SMALL) while the middle
// one stays the same, so the column's total height never changes.
const GAP = 21;
const SMALL = 72;
const MID = 162;
const LARGE = 210;
const COLUMN_HEIGHT = SMALL + MID + LARGE + GAP * 2; // 486
const LETTER_GAP = 11;
// A letter's column width = its natural width when drawn this tall.
const WIDTH_REFERENCE_HEIGHT = 80;

// Per-letter offsets and speeds so the columns drift out of sync,
// like the .seek() / .timeScale() calls in the reference.
const PHASES = [1, 0, 1.5, 0.6, 2, 0.3];
const SPEEDS = [0.8, 1, 1.2, 0.9, 1.1, 1];
const HOVER_SPEEDUP = 2.4;

const FONT = '"Anton"';

/** Animated value for one letter: vertical stretch progress (0..1). */
type LetterState = { t: number };
type Column = { x: number; w: number };

type Props = {
  word: string;
  /** Speeds the animation up (used on hover). */
  fast?: boolean;
  /** Seconds to wait before the letters rise in. */
  introDelay?: number;
  className?: string;
};

/** Places the letter columns side by side, separated by LETTER_GAP. */
function computeColumns(baseWidths: number[]): Column[] {
  let x = 0;
  return baseWidths.map((w) => {
    const col = { x, w };
    x += w + LETTER_GAP;
    return col;
  });
}

/**
 * Where the 3 copies (top, middle, bottom) of letter `i` sit right now, as
 * [top edge, height] pairs in SVG units.
 */
function letterBoxes(i: number, t: number): [number, number][] {
  // Every other letter runs in the opposite direction, like the "I" in the reference.
  const p = i % 2 ? 1 - t : t;
  const h1 = LARGE + (SMALL - LARGE) * p;
  const h3 = SMALL + (LARGE - SMALL) * p;
  return [
    [0, h1],
    [h1 + GAP, MID],
    [h1 + GAP + MID + GAP, h3],
  ];
}

/**
 * CSS transform that moves/squashes one copy into its box. Each copy is drawn
 * once at the LARGE height and only ever shrunk, so it stays sharp. Changing a
 * transform is done by the graphics card; re-drawing text every frame was
 * done by the CPU and stuttered in the Linux app (WebKitGTK).
 */
const copyTransform = ([top, height]: [number, number]) =>
  `translateY(${(top / LARGE) * 100}%) scaleY(${height / LARGE})`;

export function StretchWord({ word, fast = false, introDelay = 0, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // copyRefs.current[letter][copy] -> the layer to transform
  const copyRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const tweens = useRef<gsap.core.Tween[]>([]);
  const [glyphs, setGlyphs] = useState<GlyphBox[] | null>(null);

  // Wait for the font to load before measuring, otherwise we'd measure a fallback font.
  useEffect(() => {
    let alive = true;
    document.fonts.load(`100px ${FONT}`).then(() => {
      if (alive) setGlyphs([...word].map((c) => measureGlyph(c, FONT)));
    });
    return () => {
      alive = false;
    };
  }, [word]);

  const baseWidths = useMemo(
    () => glyphs?.map((g) => (g.width / g.height) * WIDTH_REFERENCE_HEIGHT) ?? [],
    [glyphs],
  );
  const columns = useMemo(() => computeColumns(baseWidths), [baseWidths]);
  const totalWidth = baseWidths.reduce((a, b) => a + b, 0) + LETTER_GAP * (baseWidths.length - 1);

  // One mutable state object per letter. GSAP animates these numbers and a
  // per-frame callback turns them into SVG transforms (no React re-renders).
  const states = useMemo<LetterState[]>(() => baseWidths.map(() => ({ t: 0.5 })), [baseWidths]);

  useGSAP(
    () => {
      if (!glyphs) return;
      const letters = rootRef.current!.querySelectorAll(".stretch-letter");

      // Intro: the columns rise and fade in one after another.
      gsap.from(letters, {
        opacity: 0,
        y: 90,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.07,
        delay: introDelay,
      });

      // Every frame: turn the animated numbers into transforms and write them to the DOM.
      const render = () => {
        states.forEach((state, i) =>
          letterBoxes(i, state.t).forEach((box, k) => {
            const el = copyRefs.current[i]?.[k];
            if (el) el.style.transform = copyTransform(box);
          }),
        );
      };
      gsap.ticker.add(render);

      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // Loop: animate each letter's `t` from 0 to 1 and back forever.
        tweens.current = states.map((state, i) => {
          state.t = 0;
          const tween = gsap.to(state, {
            t: 1,
            duration: 2.5,
            ease: "power1.inOut",
            repeat: -1,
            yoyo: true,
          });
          tween.timeScale(SPEEDS[i % SPEEDS.length]);
          tween.seek(PHASES[i % PHASES.length]);
          return tween;
        });
      }

      return () => gsap.ticker.remove(render);
    },
    { scope: rootRef, dependencies: [glyphs] },
  );

  // Smoothly change speed when `fast` toggles (GSAP can tween a tween's timeScale).
  useEffect(() => {
    tweens.current.forEach((tween, i) => {
      const base = SPEEDS[i % SPEEDS.length];
      gsap.to(tween, { timeScale: fast ? base * HOVER_SPEEDUP : base, duration: 0.6 });
    });
  }, [fast]);

  if (!glyphs) return <div className={className} />;

  // Positions as percentages of the whole word, so it scales with the window.
  const pctX = (v: number) => `${(v / totalWidth) * 100}%`;

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      style={{ aspectRatio: `${totalWidth} / ${COLUMN_HEIGHT}` }}
      aria-hidden
    >
      {glyphs.map((g, i) => {
        copyRefs.current[i] ??= [];
        return (
          <div key={i} className="stretch-letter absolute inset-y-0" style={{ left: pctX(columns[i].x), width: pctX(columns[i].w) }}>
            {letterBoxes(i, states[i].t).map((box, k) => (
              <div
                key={k}
                ref={(el) => {
                  copyRefs.current[i][k] = el;
                }}
                // will-change: give each copy its own GPU layer
                className="absolute inset-x-0 top-0 origin-top will-change-transform"
                style={{ height: `${(LARGE / COLUMN_HEIGHT) * 100}%`, transform: copyTransform(box) }}
              >
                {/* The glyph's ink stretched to fill the layer; drawn once, never changed */}
                <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="none" className="block size-full" fill="currentColor">
                  <text x={g.left} y={g.ascent} fontFamily={FONT} fontSize={MEASURE_FONT_SIZE}>
                    {word[i]}
                  </text>
                </svg>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
