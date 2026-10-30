import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, FileDown, Heart, ImageOff, NotebookPen, Plus, Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddDialog } from "@/components/library/AddDialog";
import { ItemDialog } from "@/components/library/ItemDialog";
import { ExportDialog } from "@/components/library/ExportDialog";
import { useLibrary } from "@/lib/queries";
import type { MediaType } from "@/lib/api/types";
import type { LibraryItem } from "@/lib/library";

const TITLES = { movie: { title: "Movies", noun: "movie" }, game: { title: "Games", noun: "game" } };

export function LibraryPage({ type }: { type: MediaType }) {
  const { title, noun } = TITLES[type];
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const library = useLibrary(type);

  useGSAP(() => {
    gsap.from(".page-in", { opacity: 0, y: 16, duration: 0.6, ease: "power2.out", stagger: 0.08 });
  }, { scope: rootRef });

  // Keyboard: Ctrl+K opens the add dialog, Esc goes back to the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSelectedId(null); // close an open item first
        setAddOpen(true);
      } else if (e.key === "Escape" && !e.defaultPrevented) {
        // defaultPrevented = an open dialog already used this Esc to close itself
        navigate("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const items = library.data ?? [];
  // look the item up by id so the dialog always shows the latest saved values
  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <main ref={rootRef} className="flex h-svh flex-col bg-background">
      <header className="page-in flex items-end justify-between gap-6 border-b border-border px-10 pt-8 pb-6">
        <div className="flex items-end gap-5">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to menu" className="mb-1">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="font-display text-6xl leading-none tracking-wide uppercase">{title}</h1>
            <p className="mt-2 text-xs tracking-[0.25em] text-muted-foreground uppercase">
              {library.isSuccess ? `${items.length} ${noun}${items.length === 1 ? "" : "s"} in library` : " "}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setExportOpen(true)}
            disabled={items.length === 0}
            className="text-muted-foreground hover:text-foreground"
          >
            <FileDown /> Export PDF
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="Settings">
            <Link to="/settings">
              <Settings />
            </Link>
          </Button>
          <AddButton noun={noun} onClick={() => setAddOpen(true)} />
        </div>
      </header>

      <section className="page-in flex-1 overflow-y-auto px-10 py-8">
        {library.isPending ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <EmptyState noun={noun} onAdd={() => setAddOpen(true)} />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-8">
            {items.map((item) => (
              <CoverCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
            ))}
          </ul>
        )}
      </section>

      <AddDialog type={type} open={addOpen} onOpenChange={setAddOpen} />
      <ItemDialog item={selected} onClose={() => setSelectedId(null)} />
      <ExportDialog type={type} items={items} open={exportOpen} onOpenChange={setExportOpen} />
    </main>
  );
}

function AddButton({ noun, onClick }: { noun: string; onClick: () => void }) {
  return (
    // Off-white on black matches the monochrome style; red stays an accent (stars, hearts, hover rings).
    <Button onClick={onClick} className="h-10 gap-2 px-4 hover:bg-white">
      <Plus />
      Add {noun}
      <kbd className="ml-1 rounded bg-black/10 px-1.5 py-0.5 font-mono text-[10px] text-black/60">Ctrl K</kbd>
    </Button>
  );
}

function CoverCard({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="group w-full text-left outline-none" aria-label={`Open ${item.title}`}>
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-white/5 transition duration-300 group-hover:-translate-y-1 group-hover:ring-brand/60 group-focus-visible:ring-2 group-focus-visible:ring-brand">
          {item.posterUrl ? (
            <img
              src={item.posterUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff />
            </div>
          )}

          {/* Personal info badges over the cover */}
          {item.favorite && (
            <Heart className="absolute top-2 right-2 size-5 fill-brand text-brand drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />
          )}
          {(item.rating !== null || item.notes) && (
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/90 to-transparent px-2.5 pt-8 pb-2">
              {item.rating !== null && (
                <span className="flex items-center gap-1 font-display text-lg leading-none">
                  <Star className="size-4 fill-brand text-brand" />
                  {item.rating}
                </span>
              )}
              {item.notes && <NotebookPen className="ml-auto size-4 text-white/70" aria-label="Has comments" />}
            </div>
          )}
        </div>
        <p className="mt-3 truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{[item.year, item.status].filter(Boolean).join(" · ")}</p>
      </button>
    </li>
  );
}

function EmptyState({ noun, onAdd }: { noun: string; onAdd: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="font-display text-4xl tracking-wide text-neutral-800 uppercase">Nothing here yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Search for your first {noun} and add it to your library.
      </p>
      <Button variant="outline" onClick={onAdd} className="mt-2 hover:border-brand hover:text-brand">
        <Plus /> Add your first {noun}
      </Button>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-8">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] rounded-lg" />
          <Skeleton className="mt-3 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
