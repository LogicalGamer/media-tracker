// Measures the *ink* bounds of a single character (the pixels actually drawn),
// not the font's line box. We need this so a letter can be stretched to fill a
// box exactly, with no empty space above or below it.

export const MEASURE_FONT_SIZE = 100;

export type GlyphBox = {
  left: number; // how far the ink extends left of the text origin
  ascent: number; // how far the ink extends above the baseline
  width: number;
  height: number;
};

let canvas: HTMLCanvasElement | null = null;

export function measureGlyph(char: string, fontFamily: string): GlyphBox {
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${MEASURE_FONT_SIZE}px ${fontFamily}`;
  const m = ctx.measureText(char);
  return {
    left: m.actualBoundingBoxLeft,
    ascent: m.actualBoundingBoxAscent,
    width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  };
}
