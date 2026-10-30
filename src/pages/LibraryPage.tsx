import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowDownUp,
  ArrowLeft,
  FileDown,
  Heart,
  ImageOff,
  NotebookPen,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AddDialog } from "@/components/library/AddDialog";
import { ItemDialog } from "@/components/library/ItemDialog";
import { ExportDialog } from "@/components/library/ExportDialog";
import { FilterPanel } from "@/components/library/FilterPanel";
import { useFillDetails, useLibrary, useSettings } from "@/lib/queries";
import {
  EMPTY_FILTERS,
  SORT_OPTIONS,
  activeFilterCount,
  applyFilters,
  sortItems,
  type Filters,
  type SortKey,
} from "@/lib/filters";
import type { MediaType } from "@/lib/api/types";
import type { LibraryItem } from "@/lib/library";
import { cn } from "@/lib/utils";

const TITLES = { movie: { title: "Movies", noun: "movie" }, game: { title: "Games", noun: "game" } };

export function LibraryPage({ type }: { type: MediaType }) {
  const { title, noun } = TITLES[type];
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const library = useLibrary(type);
  const settings = useSettings();
  const fillDetails = useFillDetails(type, library.data, settings.data);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(() => readPref(PANEL_KEY, "true") === "true");
  const sortKey = `sort-${type}`;
  const [sortBy, setSortBy] = useState(() => readPref(sortKey, "added") as SortKey);
  const searchRef = useRef<HTMLInputElement>(null);

  const togglePanel = () => {
    setPanelOpen(!panelOpen);
    savePref(PANEL_KEY, String(!panelOpen));
  };
  const changeSort = (value: SortKey) => {
    setSortBy(value);
    savePref(sortKey, value);
  };

  useGSAP(() => {
    gsap.from(".page-in", { opacity: 0, y: 16, duration: 0.6, ease: "power2.out", stagger: 0.08 });
  }, { scope: rootRef });

  // Keyboard: Ctrl+K opens the add dialog, Ctrl+F searches the library, Esc goes back to the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSelectedId(null); // close an open item first
        setAddOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && !e.defaultPrevented) {
        // defaultPrevented = an open dialog already used this Esc to close itself
        navigate("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const items = library.data ?? [];
  const shown = useMemo(() => sortItems(applyFilters(items, filters), sortBy), [items, filters, sortBy]);
  const active = activeFilterCount(filters);
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

      <div className="page-in flex min-h-0 flex-1">
        {panelOpen && items.length > 0 && (
          <FilterPanel
            type={type}
            items={items}
            filters={filters}
            onChange={setFilters}
            loadingDetails={fillDetails.isFetching}
          />
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          {items.length > 0 && (
            <div className="flex items-center gap-3 px-10 pt-6">
              <Button
                variant="ghost"
                onClick={togglePanel}
                aria-pressed={panelOpen}
                className={cn("text-muted-foreground hover:text-foreground", panelOpen && "text-foreground")}
              >
                <SlidersHorizontal />
                Filters
                {active > 0 && (
                  <span className="rounded-full bg-brand px-1.5 text-[11px] leading-4 font-semibold text-black">{active}</span>
                )}
              </Button>
              <div className="relative w-full max-w-sm">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={filters.text}
                  onChange={(e) => setFilters({ ...filters, text: e.target.value })}
                  onKeyDown={(e) => {
                    // Esc in the box clears it instead of leaving the page
                    if (e.key === "Escape" && filters.text) {
                      e.preventDefault();
                      setFilters({ ...filters, text: "" });
                    }
                  }}
                  placeholder={`Search your ${noun}s by title…`}
                  className="h-9 pl-9"
                />
              </div>
              <SortMenu value={sortBy} onChange={changeSort} />
              <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                {shown.length === items.length ? `${items.length} total` : `Showing ${shown.length} of ${items.length}`}
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-10 py-8">
            {library.isPending ? (
              <GridSkeleton />
            ) : items.length === 0 ? (
              <EmptyState noun={noun} onAdd={() => setAddOpen(true)} />
            ) : shown.length === 0 ? (
              <NoMatches onClear={() => setFilters(EMPTY_FILTERS)} />
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-8">
                {shown.map((item) => (
                  <CoverCard key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <AddDialog type={type} open={addOpen} onOpenChange={setAddOpen} />
      <ItemDialog item={selected} onClose={() => setSelectedId(null)} />
      <ExportDialog type={type} items={items} open={exportOpen} onOpenChange={setExportOpen} />
    </main>
  );
}

function AddButton({ noun, onClick }: { noun: string; onClick: () => void }) {
  return (
    // Monochrome (off-white on black, or black on white in light mode); red stays an accent.
    <Button onClick={onClick} className="h-10 gap-2 px-4">
      <Plus />
      Add {noun}
      <kbd className="ml-1 rounded bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground/60">Ctrl K</kbd>
    </Button>
  );
}

function CoverCard({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="group w-full text-left outline-none" aria-label={`Open ${item.title}`}>
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/5 transition duration-300 group-hover:-translate-y-1 group-hover:ring-brand/60 group-focus-visible:ring-2 group-focus-visible:ring-brand">
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
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/90 to-transparent px-2.5 pt-8 pb-2 text-white">
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
      <p className="font-display text-4xl tracking-wide text-foreground/15 uppercase">Nothing here yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Search for your first {noun} and add it to your library.
      </p>
      <Button variant="outline" onClick={onAdd} className="mt-2 hover:border-brand hover:text-brand">
        <Plus /> Add your first {noun}
      </Button>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="font-display text-4xl tracking-wide text-foreground/15 uppercase">No matches</p>
      <p className="text-sm text-muted-foreground">Nothing in your library fits these filters.</p>
      <Button variant="outline" onClick={onClear} className="mt-2 hover:border-brand hover:text-brand">
        Clear filters
      </Button>
    </div>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (value: SortKey) => void }) {
  const label = SORT_OPTIONS.find((o) => o.value === value)?.label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
          <ArrowDownUp />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortKey)}>
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Small view preferences (panel open, sort order) remembered on this device.
// They're only conveniences, so if storage isn't available we just use the default.
const PANEL_KEY = "filter-panel-open";
function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
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
