import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/**
 * Asks where to save, then writes the bytes there.
 * Returns the chosen path, or null if the user cancelled.
 * In a plain browser it triggers a normal download instead.
 */
export async function saveFile(defaultName: string, bytes: Uint8Array, filter: { name: string; extensions: string[] }) {
  if (!isTauri()) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
    const a = Object.assign(document.createElement("a"), { href: url, download: defaultName });
    a.click();
    URL.revokeObjectURL(url);
    return defaultName;
  }
  const path = await save({ defaultPath: defaultName, filters: [filter] });
  if (!path) return null;
  await writeFile(path, bytes);
  return path;
}
