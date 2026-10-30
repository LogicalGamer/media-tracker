import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { measureGlyph, type GlyphBox } from "@/lib/glyph-metrics";

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

/** Builds the SVG transform that stretches one glyph to fill the box (x, y, w, h). */
function fitTransform(g: GlyphBox, x: number, y: number, w: number, h: number) {
  return `translate(${x} ${y}) scale(${w / g.width} ${h / g.height}) translate(${g.left} ${g.ascent})`;
}

/** Places the letter columns side by side, separated by LETTER_GAP. */
function computeColumns(baseWidths: number[]): Column[] {
  let x = 0;
  return baseWidths.map((w) => {
    const col = { x, w };
    x += w + LETTER_GAP;
    return col;
  });
}

/** The 3 transforms (top, middle, bottom copy) for letter `i`. */
function letterTransforms(g: GlyphBox, i: number, col: Column, t: number) {
  // Every other letter runs in the opposite direction, like the "I" in the reference.
  const p = i % 2 ? 1 - t : t;
  const h1 = LARGE + (SMALL - LARGE) * p;
  const h3 = SMALL + (LARGE - SMALL) * p;
  return [
    fitTransform(g, col.x, 0, col.w, h1),
    fitTransform(g, col.x, h1 + GAP, col.w, MID),
    fitTransform(g, col.x, h1 + GAP + MID + GAP, col.w, h3),
  ];
}

export function StretchWord({ word, fast = false, introDelay = 0, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // textRefs.current[letter][copy] -> the <text> element to transform
  const textRefs = useRef<(SVGTextElement | null)[][]>([]);
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
      const letters = svgRef.current!.querySelectorAll(".stretch-letter");

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
        glyphs.forEach((g, i) =>
          letterTransforms(g, i, columns[i], states[i].t).forEach((tf, k) =>
            textRefs.current[i][k]?.setAttribute("transform", tf),
          ),
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
    { scope: svgRef, dependencies: [glyphs] },
  );

  // Smoothly change speed when `fast` toggles (GSAP can tween a tween's timeScale).
  useEffect(() => {
    tweens.current.forEach((tween, i) => {
      const base = SPEEDS[i % SPEEDS.length];
      gsap.to(tween, { timeScale: fast ? base * HOVER_SPEEDUP : base, duration: 0.6 });
    });
  }, [fast]);

  if (!glyphs) return <div className={className} />;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${totalWidth} ${COLUMN_HEIGHT}`}
      className={className}
      fill="currentColor"
      aria-hidden
    >
      {glyphs.map((g, i) => {
        textRefs.current[i] ??= [];
        return (
          <g key={i} className="stretch-letter">
            {letterTransforms(g, i, columns[i], states[i].t).map((tf, k) => (
              <text
                key={k}
                ref={(el) => {
                  textRefs.current[i][k] = el;
                }}
                transform={tf}
                fontFamily={FONT}
                fontSize={100}
              >
                {word[i]}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
