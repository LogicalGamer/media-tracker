import { useState } from "react";
import { Check, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFile } from "@/lib/save-file";
import type { LibraryItem } from "@/lib/library";
import type { ExportOptions } from "@/lib/export-pdf";
import type { MediaType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Props = { type: MediaType; items: LibraryItem[]; open: boolean; onOpenChange: (open: boolean) => void };

const SORTS: { value: ExportOptions["sortBy"]; label: string }[] = [
  { value: "added", label: "Date added" },
  { value: "rating", label: "Your rating" },
  { value: "title", label: "Title" },
];

export function ExportDialog({ type, items, open, onOpenChange }: Props) {
  const noun = type === "movie" ? "Movies" : "Games";
  const [options, setOptions] = useState<ExportOptions>({
    title: `My ${noun}`,
    includeComments: true,
    onlyFavorites: false,
    sortBy: "rating",
  });
  const [busy, setBusy] = useState(false);
  const set = (changes: Partial<ExportOptions>) => setOptions((o) => ({ ...o, ...changes }));

  const count = options.onlyFavorites ? items.filter((i) => i.favorite).length : items.length;

  const exportPdf = async () => {
    setBusy(true);
    try {
      // Loaded only now: the PDF library is large and not needed until someone exports.
      const { renderLibraryPdf } = await import("@/lib/export-pdf");
      const bytes = await renderLibraryPdf(items, options);
      const fileName = `${options.title.trim() || noun}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
      const path = await saveFile(fileName, bytes, { name: "PDF", extensions: ["pdf"] });
      if (path) {
        toast.success("PDF saved", { description: path });
        onOpenChange(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create the PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide uppercase">Export to PDF</DialogTitle>
          <DialogDescription>A shareable list with covers, your ratings and comments.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-5">
          <div>
            <Label htmlFor="export-title" className="text-xs text-muted-foreground">
              Title
            </Label>
            <Input
              id="export-title"
              value={options.title}
              onChange={(e) => set({ title: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Sort by</p>
            <div className="mt-1.5 flex gap-2">
              {SORTS.map((o) => (
                <Chip key={o.value} active={options.sortBy === o.value} onClick={() => set({ sortBy: o.value })}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Toggle checked={options.includeComments} onChange={(v) => set({ includeComments: v })}>
              Include my comments
            </Toggle>
            <Toggle checked={options.onlyFavorites} onChange={(v) => set({ onlyFavorites: v })}>
              Only favorites
            </Toggle>
          </div>
        </div>

        <Button onClick={exportPdf} disabled={busy || count === 0} className="mt-4 h-10">
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
          {busy ? "Creating PDF…" : `Export ${count} ${count === 1 ? noun.slice(0, -1).toLowerCase() : noun.toLowerCase()}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left text-sm"
    >
      <span
        className={cn(
          "flex size-4.5 items-center justify-center rounded border transition-colors",
          checked ? "border-foreground bg-foreground text-background" : "border-neutral-600",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
