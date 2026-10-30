import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";

/** A link that opens in the user's real browser (inside Tauri a normal <a> would navigate the app window). */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("underline-offset-4 hover:underline", className)}
      onClick={(e) => {
        if (!isTauri()) return;
        e.preventDefault();
        openUrl(href);
      }}
    >
      {children}
    </a>
  );
}
