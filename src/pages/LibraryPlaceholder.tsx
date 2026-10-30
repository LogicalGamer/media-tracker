import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Temporary screen until the real library is built (stage 4).
export function LibraryPlaceholder({ title }: { title: string }) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.from(rootRef.current, { opacity: 0, y: 20, duration: 0.6, ease: "power2.out" });
  });

  // Esc goes back to the opening menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && navigate("/");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <main ref={rootRef} className="flex h-svh flex-col items-center justify-center gap-6 bg-background">
      <h1 className="font-display text-7xl tracking-wide text-foreground uppercase">{title}</h1>
      <p className="text-sm text-muted-foreground">Your library will live here.</p>
      <Button variant="outline" onClick={() => navigate("/")}>
        <ArrowLeft /> Back to menu <kbd className="ml-1 font-mono text-[10px] opacity-60">Esc</kbd>
      </Button>
    </main>
  );
}
