import { isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile } from "@tauri-apps/plugin-fs";

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

/**
 * Asks the user to pick a file and returns its text, or null if they cancelled.
 * In a plain browser it uses a normal file picker instead.
 */
export async function openTextFile(filter: { name: string; extensions: string[] }): Promise<string | null> {
  if (!isTauri()) {
    return new Promise((resolve) => {
      const input = Object.assign(document.createElement("input"), {
        type: "file",
        accept: filter.extensions.map((e) => `.${e}`).join(","),
      });
      input.onchange = () => (input.files?.[0] ? input.files[0].text().then(resolve) : resolve(null));
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  const path = await open({ multiple: false, directory: false, filters: [filter] });
  return path ? readTextFile(path) : null;
}
