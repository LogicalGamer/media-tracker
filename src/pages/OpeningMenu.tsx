import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
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
  const [active, setActive] = useState<Option["id"] | null>(null);
  const leaving = useRef(false);

  // Fade in the small UI text (the big words animate themselves).
  useGSAP(
    () => {
      gsap.from(".menu-fade", { opacity: 0, y: 12, duration: 1, ease: "power2.out", stagger: 0.1, delay: 0.6 });
    },
    { scope: rootRef },
  );

  /** Plays the exit animation, then switches to the chosen section. */
  const choose = (id: Option["id"]) => {
    if (leaving.current) return;
    leaving.current = true;
    setActive(id);
    gsap.to(rootRef.current, {
      opacity: 0,
      scale: 1.04,
      filter: "blur(10px)",
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
        <span className="hidden sm:inline">Choose your library</span>
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
                "text-neutral-200 transition-colors duration-500 ease-out",
                isActive && "text-brand",
                isDimmed && "text-neutral-800",
              )}
            >
              {/* Soft glow behind the hovered word */}
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full bg-brand/15 blur-3xl transition-opacity duration-700",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <StretchWord
                word={o.word}
                fast={isActive}
                introDelay={0.15 + i * 0.25}
                className="h-[52vh] w-auto max-w-[40vw]"
              />
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

      <footer className="menu-fade px-10 pb-8 text-center text-[11px] tracking-[0.2em] text-neutral-600 uppercase">
        Hover to preview · Click or press 1 / 2 to enter
      </footer>
    </main>
  );
}
