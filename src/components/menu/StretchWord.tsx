import { useEffect, useRef, useState } from "react";
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

type Props = {
  word: string;
  /** Speeds the animation up (used on hover). */
  fast?: boolean;
  /** Seconds to wait before the letters rise in. */
  introDelay?: number;
  className?: string;
};

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

  // x position and width of every letter column
  const columns: { x: number; w: number }[] = [];
  let totalWidth = 0;
  glyphs?.forEach((g, i) => {
    const w = (g.width / g.height) * WIDTH_REFERENCE_HEIGHT;
    columns.push({ x: totalWidth, w });
    totalWidth += w + (i < glyphs.length - 1 ? LETTER_GAP : 0);
  });

  /** Builds the SVG transform that stretches one glyph to fill the box (x, y, w, h). */
  const fitTransform = (g: GlyphBox, x: number, y: number, w: number, h: number) =>
    `translate(${x} ${y}) scale(${w / g.width} ${h / g.height}) translate(${g.left} ${g.ascent})`;

  /** Lays out the 3 copies of letter `i` for progress `t` (0..1). */
  const layoutLetter = (i: number, t: number) => {
    if (!glyphs) return [];
    // Every other letter runs in the opposite direction, like the "I" in the reference.
    const p = i % 2 ? 1 - t : t;
    const h1 = LARGE + (SMALL - LARGE) * p;
    const h3 = SMALL + (LARGE - SMALL) * p;
    const { x, w } = columns[i];
    return [
      fitTransform(glyphs[i], x, 0, w, h1),
      fitTransform(glyphs[i], x, h1 + GAP, w, MID),
      fitTransform(glyphs[i], x, h1 + GAP + MID + GAP, w, h3),
    ];
  };

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

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Loop: animate a plain number from 0 to 1 and back, and on every frame
      // write the new transforms straight to the DOM (no React re-render).
      tweens.current = glyphs.map((_, i) => {
        const state = { t: 0 };
        const tween = gsap.to(state, {
          t: 1,
          duration: 2.5,
          ease: "power1.inOut",
          repeat: -1,
          yoyo: true,
          onUpdate: () => {
            layoutLetter(i, state.t).forEach((tf, k) =>
              textRefs.current[i][k]?.setAttribute("transform", tf),
            );
          },
        });
        tween.timeScale(SPEEDS[i % SPEEDS.length]);
        tween.seek(PHASES[i % PHASES.length]);
        return tween;
      });
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
      {glyphs.map((_, i) => {
        textRefs.current[i] ??= [];
        return (
          <g key={i} className="stretch-letter">
            {layoutLetter(i, 0.5).map((tf, k) => (
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
