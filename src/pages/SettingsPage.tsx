import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
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
      </div>
    </main>
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
