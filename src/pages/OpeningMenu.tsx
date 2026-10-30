import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Settings } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { StretchWord } from "@/components/menu/StretchWord";
import { cn } from "@/lib/utils";

type Option = { id: "movies" | "games"; word: string; label: string; key: string };

const OPTIONS: Option[] = [
  { id: "movies", word: "MOVIES", label: "Films", key: "1" },
  { id: "games", word: "GAMES", label: "Video games", key: "2" },
];

export function OpeningMenu() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // wordBoxes = untransformed boxes we measure; wordInners = the parts we stretch
  const wordBoxes = useRef<(HTMLDivElement | null)[]>([]);
  const wordInners = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState<Option["id"] | null>(null);
  const leaving = useRef(false);

  // Fade in the small UI text (the big words animate themselves).
  useGSAP(
    () => {
      gsap.from(".menu-fade", { opacity: 0, y: 12, duration: 1, ease: "power2.out", stagger: 0.1, delay: 0.6 });
    },
    { scope: rootRef },
  );

  // Hover: stretch the active word sideways until it fully covers the other one.
  // MOVIES grows from its left edge to the right, GAMES from its right edge to the left.
  useEffect(() => {
    const boxes = wordBoxes.current.map((el) => el!.getBoundingClientRect());
    OPTIONS.forEach((o, i) => {
      let scaleX = 1;
      if (o.id === active) {
        const mine = boxes[i];
        const other = boxes[1 - i];
        const reach = i === 0 ? other.right - mine.left : mine.right - other.left;
        scaleX = reach / mine.width;
      }
      gsap.to(wordInners.current[i], {
        scaleX,
        transformOrigin: i === 0 ? "left center" : "right center",
        duration: 0.9,
        ease: "expo.out",
        overwrite: "auto",
      });
    });
  }, [active]);

  /** Plays the exit animation, then switches to the chosen section. */
  const choose = (id: Option["id"]) => {
    if (leaving.current) return;
    leaving.current = true;
    setActive(id);
    gsap.to(rootRef.current, {
      opacity: 0,
      scale: 1.04,
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => navigate(`/${id}`),
    });
  };

  // Keyboard: 1 / 2 pick an option, arrow keys move focus between them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const byKey = OPTIONS.find((o) => o.key === e.key);
      if (byKey) return choose(byKey.id);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const current = OPTIONS.findIndex((o) => o.id === active);
        const next = e.key === "ArrowRight" ? Math.min(current + 1, OPTIONS.length - 1) : Math.max(current - 1, 0);
        buttonRefs.current[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main ref={rootRef} className="relative flex h-svh flex-col overflow-hidden bg-background select-none">
      <header className="menu-fade flex items-center justify-between px-10 pt-8 text-xs tracking-[0.3em] text-muted-foreground uppercase">
        <span>Media Tracker</span>
        <span className="flex items-center gap-5">
          <span className="hidden sm:inline">Choose your library</span>
          <Link to="/settings" aria-label="Settings" className="transition-colors hover:text-foreground">
            <Settings className="size-4" />
          </Link>
        </span>
      </header>

      <nav className="flex flex-1 items-center justify-center gap-[7vw] px-10">
        {OPTIONS.map((o, i) => {
          const isActive = active === o.id;
          const isDimmed = active !== null && !isActive;
          return (
            <button
              key={o.id}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              onClick={() => choose(o.id)}
              onMouseEnter={() => setActive(o.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(o.id)}
              onBlur={() => setActive(null)}
              aria-label={`Open ${o.label}`}
              className={cn(
                "group relative flex flex-col items-center gap-6 outline-none",
                "text-foreground/90 transition-colors duration-500 ease-out",
                // the active word sits in front so it can cover the other one
                isActive && "z-10 text-brand",
                isDimmed && "text-foreground/10",
              )}
            >
              {/* Soft glow behind the hovered word. A gradient, not a blur filter: big blurs are very slow on Linux */}
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 -z-10 scale-150 bg-[radial-gradient(closest-side,rgb(255_60_56/0.16),transparent)] transition-opacity duration-700",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                ref={(el) => {
                  wordBoxes.current[i] = el;
                }}
              >
                {/* pointer-events-none: the stretched word must not block hovering the other option */}
                <div
                  ref={(el) => {
                    wordInners.current[i] = el;
                  }}
                  className="pointer-events-none"
                >
                  <StretchWord
                    word={o.word}
                    fast={isActive}
                    introDelay={0.15 + i * 0.25}
                    className="block h-[52vh] w-auto max-w-[40vw]"
                  />
                </div>
              </div>
              <span className="menu-fade flex items-center gap-3 text-sm tracking-[0.25em] uppercase">
                <kbd className="rounded border border-current/30 px-1.5 py-0.5 font-mono text-[10px] tracking-normal opacity-60">
                  {o.key}
                </kbd>
                {o.label}
              </span>
            </button>
          );
        })}
      </nav>

      <footer className="menu-fade px-10 pb-8 text-center text-[11px] tracking-[0.2em] text-muted-foreground/70 uppercase">
        Hover to preview · Click or press 1 / 2 to enter
      </footer>
    </main>
  );
}
