import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, ImageOff, KeyRound, Plus, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "@/components/ExternalLink";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { hasKeysFor, useAddItem, useLibrary, useSearch, useSettings } from "@/lib/queries";
import type { MediaType, SearchResult } from "@/lib/api/types";
import { ApiError } from "@/lib/http";

const COPY = {
  movie: { noun: "movie", api: "TMDB", apiUrl: "https://www.themoviedb.org", placeholder: "Search movies… e.g. Blade Runner" },
  game: { noun: "game", api: "IGDB", apiUrl: "https://www.igdb.com", placeholder: "Search games… e.g. Hollow Knight" },
};

type Props = { type: MediaType; open: boolean; onOpenChange: (open: boolean) => void };

export function AddDialog({ type, open, onOpenChange }: Props) {
  const copy = COPY[type];
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim());

  const settings = useSettings();
  const hasKeys = hasKeysFor(type, settings.data);
  const search = useSearch(type, debounced, settings.data);
  const library = useLibrary(type);
  const addItem = useAddItem();

  // ids already in the library, so their button shows "Added"
  const savedIds = new Set(library.data?.map((i) => i.externalId));

  const add = (result: SearchResult) =>
    addItem.mutate(result, {
      onSuccess: () => toast.success(`Added “${result.title}”`),
      onError: () => toast.error(`Couldn't save “${result.title}”`),
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery(""); // start fresh next time
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle className="font-display text-2xl tracking-wide uppercase">Add {copy.noun}</DialogTitle>
          <DialogDescription>Search {copy.api} and add it to your library.</DialogDescription>
          <div className="relative mt-3">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.placeholder}
              className="h-11 pl-9 text-base"
              disabled={!hasKeys}
            />
          </div>
        </DialogHeader>

        <div className="h-[min(26rem,55vh)] overflow-y-auto px-2 py-2">
          {settings.isSuccess && !hasKeys ? (
            <MissingKey api={copy.api} onClose={() => onOpenChange(false)} />
          ) : debounced.length < 2 ? (
            <Message icon={<Search />}>Type at least 2 letters to search.</Message>
          ) : search.isPending ? (
            <ResultSkeletons />
          ) : search.isError ? (
            <Message icon={<TriangleAlert />} tone="error">
              {search.error instanceof ApiError ? search.error.message : "Something went wrong."}
            </Message>
          ) : search.data.length === 0 ? (
            <Message icon={<Search />}>No {copy.noun}s found for “{debounced}”.</Message>
          ) : (
            <ul className="flex flex-col">
              {search.data.map((r) => (
                <ResultRow
                  key={r.externalId}
                  result={r}
                  added={savedIds.has(r.externalId)}
                  onAdd={() => add(r)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Attribution required by the API terms */}
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Data from <ExternalLink href={copy.apiUrl} className="text-foreground">{copy.api}</ExternalLink>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultRow({ result, added, onAdd }: { result: SearchResult; added: boolean; onAdd: () => void }) {
  const details = [result.year, result.genres.slice(0, 3).join(" · ")].filter(Boolean).join("  —  ");
  return (
    <li className="group flex items-center gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-accent/60">
      <Poster url={result.posterUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{result.title}</p>
        <p className="truncate text-xs text-muted-foreground">{details || "No details"}</p>
        {result.platforms && result.platforms.length > 0 && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{result.platforms.join(", ")}</p>
        )}
      </div>
      <Button
        size="sm"
        variant={added ? "ghost" : "outline"}
        disabled={added}
        onClick={onAdd}
        className={added ? "text-brand" : "group-hover:border-brand group-hover:text-brand"}
      >
        {added ? <Check /> : <Plus />}
        {added ? "Added" : "Add"}
      </Button>
    </li>
  );
}

function Poster({ url }: { url: string | null }) {
  return (
    <div className="flex h-[72px] w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageOff className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function ResultSkeletons() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2">
          <Skeleton className="h-[72px] w-12 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Message({ icon, tone, children }: { icon: React.ReactNode; tone?: "error"; children: React.ReactNode }) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-sm [&_svg]:size-6 ${
        tone === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {icon}
      <p>{children}</p>
    </div>
  );
}

function MissingKey({ api, onClose }: { api: string; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Message icon={<KeyRound />}>
      <span className="block">Add your {api} key in Settings to search.</span>
      <Button
        className="mt-4"
        onClick={() => {
          onClose();
          navigate("/settings");
        }}
      >
        Open Settings
      </Button>
    </Message>
  );
}
