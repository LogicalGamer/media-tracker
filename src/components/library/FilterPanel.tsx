import { useMemo, useState } from "react";
import { Check, Heart, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FACETS,
  EMPTY_FILTERS,
  RATING_OPTIONS,
  activeFilterCount,
  facetOptions,
  type FacetKey,
  type Filters,
} from "@/lib/filters";
import type { MediaType } from "@/lib/api/types";
import type { LibraryItem } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = {
  type: MediaType;
  items: LibraryItem[]; // the whole library: every name is listed, even if other filters hide its items
  filters: Filters;
  onChange: (filters: Filters) => void;
  loadingDetails: boolean; // directors/composers/developers are still being looked up
};

/** Side panel listing every genre, director, composer (or developer) in the library to filter by. */
export function FilterPanel({ type, items, filters, onChange, loadingDetails }: Props) {
  const set = (changes: Partial<Filters>) => onChange({ ...filters, ...changes });
  const toggleFacet = (key: FacetKey, value: string) => {
    const chosen = filters.facets[key];
    const next = chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
    set({ facets: { ...filters.facets, [key]: next } });
  };
  const active = activeFilterCount(filters);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-7 overflow-y-auto border-r border-border px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide uppercase">Filters</h2>
        {active > 0 && (
          <button
            onClick={() => onChange({ ...EMPTY_FILTERS, text: filters.text })}
            className="text-xs text-muted-foreground transition-colors hover:text-brand"
          >
            Clear all ({active})
          </button>
        )}
      </div>

      <button
        onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}
        aria-pressed={filters.favoritesOnly}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
          filters.favoritesOnly ? "border-brand text-brand" : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        <Heart className={cn("size-4", filters.favoritesOnly && "fill-brand")} />
        Favorites only
      </button>

      <Section label="My rating">
        <div className="flex flex-wrap gap-1.5">
          {RATING_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => set({ rating: o.value })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filters.rating === o.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>

      {FACETS[type].map(({ key, label }) => (
        <FacetList
          key={key}
          label={label}
          options={facetOptions(items, key)}
          chosen={filters.facets[key]}
          onToggle={(value) => toggleFacet(key, value)}
          loading={loadingDetails && key !== "genres"}
        />
      ))}
    </aside>
  );
}

function Section({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[11px] tracking-[0.25em] text-muted-foreground uppercase">
        {label}
        {extra}
      </h3>
      {children}
    </section>
  );
}

type FacetListProps = {
  label: string;
  options: { value: string; count: number }[];
  chosen: string[];
  onToggle: (value: string) => void;
  loading: boolean;
};

/** Every name with a checkbox and how many items have it. Long lists get their own small search box. */
function FacetList({ label, options, chosen, onToggle, loading }: FacetListProps) {
  const [find, setFind] = useState("");
  const shown = useMemo(
    () => options.filter((o) => o.value.toLowerCase().includes(find.trim().toLowerCase())),
    [options, find],
  );

  return (
    <Section
      label={label}
      extra={
        <>
          {chosen.length > 0 && <span className="text-brand">{chosen.length}</span>}
          {loading && <Loader2 className="size-3 animate-spin" aria-label="Loading" />}
        </>
      }
    >
      {options.length > 8 && (
        <div className="relative mb-2">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={`Find ${label.toLowerCase()}…`}
            className="h-8 pl-8 text-xs"
          />
        </div>
      )}

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">{loading ? "Looking up names…" : "Nothing yet"}</p>
      ) : (
        <ul className="-mx-2 max-h-64 overflow-y-auto">
          {shown.map(({ value, count }) => {
            const on = chosen.includes(value);
            return (
              <li key={value}>
                <button
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(value)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-foreground/5"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      on ? "border-brand bg-brand text-black" : "border-muted-foreground/60",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", on ? "text-foreground" : "text-muted-foreground")}>
                    {value}
                  </span>
                  <span className="text-xs text-muted-foreground/60 tabular-nums">{count}</span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground/70">No match</li>}
        </ul>
      )}
    </Section>
  );
}
