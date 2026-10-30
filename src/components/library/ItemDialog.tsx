import { useEffect, useRef, useState } from "react";
import { Check, Heart, ImageOff, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRemoveItem, useUpdateItem } from "@/lib/queries";
import { GAME_STATUSES, MOVIE_STATUSES, type LibraryItem, type Status } from "@/lib/library";
import { cn } from "@/lib/utils";

type Props = { item: LibraryItem | null; onClose: () => void };

/** Details of one saved movie/game, where the user edits status, rating, favorite and notes. */
export function ItemDialog({ item, onClose }: Props) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {/* key: start with fresh local state (notes, confirm) for each item */}
        {item && <ItemDetails key={item.id} item={item} onRemoved={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ItemDetails({ item, onRemoved }: { item: LibraryItem; onRemoved: () => void }) {
  const update = useUpdateItem(item.type);
  const remove = useRemoveItem(item.type);
  const save = (changes: Parameters<typeof update.mutate>[0]["changes"]) => update.mutate({ id: item.id, changes });

  const statuses = item.type === "movie" ? MOVIE_STATUSES : GAME_STATUSES;
  const details = [item.year, item.genres.join(" · ")].filter(Boolean).join("  —  ");

  return (
    <div className="flex max-h-[85vh]">
      {/* Cover */}
      <div className="hidden w-64 shrink-0 bg-muted sm:block">
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="pr-8">
          <DialogTitle className="font-display text-3xl leading-tight tracking-wide uppercase">{item.title}</DialogTitle>
          <DialogDescription className="mt-1">{details || "No details"}</DialogDescription>
          {item.extra.platforms && item.extra.platforms.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground/70">{item.extra.platforms.join(", ")}</p>
          )}
        </div>

        <Section label="Status">
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <StatusChip key={s} status={s} active={item.status === s} onClick={() => save({ status: s })} />
            ))}
          </div>
        </Section>

        <Section label="Your rating">
          <div className="flex items-center gap-4">
            <RatingInput value={item.rating} onChange={(rating) => save({ rating })} />
            <FavoriteToggle value={item.favorite} onChange={(favorite) => save({ favorite })} />
          </div>
        </Section>

        <Section label="Your comments">
          <NotesInput initial={item.notes} onSave={(notes) => save({ notes })} />
        </Section>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Added {new Date(item.addedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
          <RemoveButton
            onConfirm={() =>
              remove.mutate(item.id, {
                onSuccess: () => {
                  toast(`Removed “${item.title}”`);
                  onRemoved();
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] tracking-[0.25em] text-muted-foreground uppercase">{label}</h3>
      {children}
    </section>
  );
}

function StatusChip({ status, active, onClick }: { status: Status; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-brand bg-brand/15 text-brand"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {active && <Check className="size-3.5" />}
      {status}
    </button>
  );
}

/** 10 stars. Hovering previews a value; clicking the current value again clears it. */
function RatingInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Rating">
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} out of 10`}
              onMouseEnter={() => setHover(n)}
              onClick={() => onChange(value === n ? null : n)}
              className="p-0.5 transition-transform hover:scale-125"
            >
              <Star
                className={cn(
                  "size-5 transition-colors",
                  n <= shown ? "fill-brand text-brand" : "text-neutral-700",
                )}
              />
            </button>
          );
        })}
      </div>
      <span className="w-12 font-display text-xl tabular-nums">
        {shown ? shown : "–"}
        <span className="text-sm text-muted-foreground">/10</span>
      </span>
    </div>
  );
}

function FavoriteToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        value ? "border-brand text-brand" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Heart className={cn("size-4 transition-transform", value && "scale-110 fill-brand")} />
      Favorite
    </button>
  );
}

/** Free-text notes that save themselves shortly after you stop typing (and when the dialog closes). */
function NotesInput({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  // `initial` changes after each save (the item reloads), so remember the original text once
  const [original] = useState(initial);
  const [notes, setNotes] = useState(initial);
  const debounced = useDebouncedValue(notes, 600);
  const saved = useRef(initial);

  const flush = (value: string) => {
    if (value === saved.current) return;
    saved.current = value;
    onSave(value);
  };

  useEffect(() => flush(debounced), [debounced]);

  // Save whatever is pending when the dialog closes before the debounce fires.
  const latest = useRef(notes);
  latest.current = notes;
  useEffect(() => () => flush(latest.current), []);

  const pending = notes !== debounced;
  return (
    <div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What did you think? Favorite moments, who you watched/played it with…"
        className="min-h-32 resize-y text-sm leading-relaxed"
      />
      <p className="mt-1.5 h-4 text-right text-[11px] text-muted-foreground">
        {pending ? "Typing…" : debounced !== original ? "Saved" : ""}
      </p>
    </div>
  );
}

/** Asks for a second click before removing, instead of a separate confirmation dialog. */
function RemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3000); // disarm if not confirmed
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={cn("text-muted-foreground", armed ? "text-destructive hover:text-destructive" : "hover:text-destructive")}
    >
      <Trash2 />
      {armed ? "Click again to remove" : "Remove"}
    </Button>
  );
}
