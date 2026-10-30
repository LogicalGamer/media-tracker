import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, Eye, EyeOff, Loader2, Moon, Sun, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "@/components/ExternalLink";
import { useSaveSettings, useSettings } from "@/lib/queries";
import { validateTmdbToken } from "@/lib/api/tmdb";
import { validateIgdb } from "@/lib/api/igdb";
import { ApiError } from "@/lib/http";
import { PROXY } from "@/lib/api/proxy";
import type { Settings } from "@/lib/settings";
import { listAllItems, restoreItems } from "@/lib/library";
import { createBackup, readBackup } from "@/lib/backup";
import { openTextFile, saveFile } from "@/lib/save-file";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettings();

  // Esc goes back to wherever we came from
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && navigate(-1);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <main className="h-svh overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-10 py-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft />
          </Button>
          <h1 className="font-display text-5xl tracking-wide uppercase">Settings</h1>
        </div>

        <h2 className="mt-10 text-xs tracking-[0.25em] text-muted-foreground uppercase">
          {PROXY ? "Your own API keys (optional)" : "API keys"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {PROXY
            ? "Search already works through the shared server. Only add your own keys if you'd rather use them; they're stored only on this device."
            : "Keys are stored only on this device. They're needed to search for new movies and games."}
        </p>

        {settings.data && (
          <div className="mt-6 flex flex-col gap-6">
            <KeyCard
              title="Movies — TMDB"
              fields={[{ field: "tmdbToken", label: "API Read Access Token" }]}
              help="themoviedb.org → Settings → API → “API Read Access Token” (the long one)."
              helpUrl="https://www.themoviedb.org/settings/api"
              settings={settings.data}
              validate={(v) => validateTmdbToken(v.tmdbToken)}
            />
            <KeyCard
              title="Games — IGDB"
              fields={[
                { field: "igdbClientId", label: "Client ID" },
                { field: "igdbClientSecret", label: "Client Secret" },
              ]}
              help="dev.twitch.tv → Console → Register Your Application."
              helpUrl="https://dev.twitch.tv/console/apps"
              settings={settings.data}
              validate={(v) => validateIgdb({ clientId: v.igdbClientId, clientSecret: v.igdbClientSecret })}
            />
          </div>
        )}

        <SectionTitle>Library backup</SectionTitle>
        <BackupCard />

        <SectionTitle>Appearance</SectionTitle>
        <ThemeCard />

        <SectionTitle>About</SectionTitle>
        <AboutCard />
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-12 mb-4 text-xs tracking-[0.25em] text-muted-foreground uppercase">{children}</h2>;
}

/** Save the whole library to a JSON file, or load one back (nothing is ever deleted by loading). */
function BackupCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const filter = { name: "Media Tracker backup", extensions: ["json"] };

  const backUp = async () => {
    setBusy(true);
    try {
      const items = await listAllItems();
      const date = new Date().toISOString().slice(0, 10); // 2026-10-30
      const path = await saveFile(`media-tracker-backup-${date}.json`, new TextEncoder().encode(createBackup(items)), filter);
      if (path) toast.success(`Backed up ${items.length} item${items.length === 1 ? "" : "s"}`, { description: path });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save the backup");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const text = await openTextFile(filter);
      if (text === null) return; // cancelled
      const { items, skipped } = readBackup(text);
      const { added, updated } = await restoreItems(items);
      await qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Backup restored", {
        description: `${added} added, ${updated} updated${skipped ? `, ${skipped} damaged entries skipped` : ""}`,
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't restore", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <p className="text-sm text-muted-foreground">
        Saves all your movies and games, with ratings and comments, to one file. Restore it on a new computer or
        after reinstalling. Restoring adds what's missing and updates what you already have; it never deletes anything.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={backUp} disabled={busy}>
          <Download /> Back up library
        </Button>
        <Button variant="outline" onClick={restore} disabled={busy}>
          <Upload /> Restore from file
        </Button>
      </div>
    </div>
  );
}

function ThemeCard() {
  const [theme, setTheme] = useTheme();
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "dark", label: "Dark", icon: <Moon /> },
    { value: "light", label: "Light", icon: <Sun /> },
  ];
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          aria-pressed={theme === o.value}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors [&_svg]:size-4",
            theme === o.value
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AboutCard() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-5 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl tracking-wide uppercase">Media Tracker</span>
        <span className="text-xs text-muted-foreground">Version {__APP_VERSION__}</span>
      </div>
      <p className="text-muted-foreground">
        Movie data from{" "}
        <ExternalLink href="https://www.themoviedb.org" className="text-foreground">
          TMDB
        </ExternalLink>
        . This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <p className="text-muted-foreground">
        Game data from{" "}
        <ExternalLink href="https://www.igdb.com" className="text-foreground">
          IGDB.com
        </ExternalLink>
        .
      </p>
      <p className="text-xs text-muted-foreground/70">
        Your library is stored only on this computer. Movie details are refreshed from TMDB when they're older than
        6 months.
      </p>
    </div>
  );
}

type KeyCardProps = {
  title: string;
  fields: { field: keyof Settings; label: string }[];
  help: string;
  helpUrl: string;
  settings: Settings;
  validate: (values: Settings) => Promise<void>;
};

type Check = { state: "idle" } | { state: "checking" } | { state: "ok" } | { state: "error"; message: string };

/**
 * A card with one or more key inputs and a "Save & test" button: saves the
 * values, then makes a tiny request to check they work.
 */
function KeyCard({ title, fields, help, helpUrl, settings, validate }: KeyCardProps) {
  const [values, setValues] = useState(settings);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const save = useSaveSettings();

  const onSave = async () => {
    // only save this card's fields, trimmed (pasted keys often carry spaces)
    const changes = Object.fromEntries(fields.map(({ field }) => [field, values[field].trim()])) as Partial<Settings>;
    await save.mutateAsync(changes);
    const all = { ...values, ...changes };
    if (fields.some(({ field }) => !all[field])) {
      setCheck({ state: "idle" });
      toast("Saved — fill in every field to enable search");
      return;
    }
    setCheck({ state: "checking" });
    try {
      await validate(all);
      setCheck({ state: "ok" });
      toast.success("Saved and working");
    } catch (e) {
      setCheck({ state: "error", message: e instanceof ApiError ? e.message : "Couldn't check the key." });
    }
  };

  return (
    <form
      className="rounded-xl border border-border bg-card/40 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-4 flex flex-col gap-4">
        {fields.map(({ field, label }) => (
          <SecretInput
            key={field}
            id={field}
            label={label}
            value={values[field]}
            onChange={(v) => {
              setValues((old) => ({ ...old, [field]: v }));
              setCheck({ state: "idle" });
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="min-h-5 text-xs">
          {check.state === "checking" && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Checking…
            </span>
          )}
          {check.state === "ok" && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="size-3.5" /> Works.
            </span>
          )}
          {check.state === "error" && (
            <span className="flex items-center gap-1.5 text-destructive">
              <XCircle className="size-3.5" /> {check.message}
            </span>
          )}
          {check.state === "idle" && (
            <span className="text-muted-foreground">
              Get it at <ExternalLink href={helpUrl} className="text-foreground">{help}</ExternalLink>
            </span>
          )}
        </div>
        <Button type="submit" disabled={check.state === "checking"} className="shrink-0">
          Save & test
        </Button>
      </div>
    </form>
  );
}

/** A password-style input with a show/hide eye button. */
function SecretInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste here"
          autoComplete="off"
          spellCheck={false}
          className="pr-10 font-mono"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide" : "Show"}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground [&_svg]:size-4"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
}
