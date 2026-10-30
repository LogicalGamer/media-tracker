// Builds a shareable PDF of the library with @react-pdf/renderer: you describe
// the pages with React-like components (<Page>, <View>, <Text>, ...) and it
// produces the PDF file. This module is big, so the app only loads it when the
// user actually exports (see the dynamic import in ExportDialog).

import { Document, Font, Image, Page, Path, Polygon, StyleSheet, Svg, Text, View, pdf } from "@react-pdf/renderer";
import antonUrl from "@fontsource/anton/files/anton-latin-400-normal.woff?url";
import { fetchBytes } from "@/lib/http";
import type { LibraryItem } from "@/lib/library";
import { sortItems, type SortKey } from "@/lib/filters";

Font.register({ family: "Anton", src: antonUrl });
// Don't hyphenate words when wrapping (titles looked odd split as "Run-ner").
Font.registerHyphenationCallback((word) => [word]);

const C = { bg: "#000000", text: "#f2f2f2", muted: "#8a8a8a", faint: "#2a2a2a", brand: "#ff3c38" };

export type ExportOptions = {
  title: string;
  includeComments: boolean;
  onlyFavorites: boolean;
  sortBy: SortKey;
};

/** Returns the finished PDF file as bytes. */
export async function renderLibraryPdf(items: LibraryItem[], options: ExportOptions): Promise<Uint8Array> {
  const chosen = sortItems(
    items.filter((i) => !options.onlyFavorites || i.favorite),
    options.sortBy,
  );
  // PDFs can't load images from the internet while rendering here, so download the covers first.
  const covers = await Promise.all(chosen.map((i) => loadCover(i.posterUrl)));
  const blob = await pdf(<LibraryDocument items={chosen} covers={covers} options={options} />).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/** Downloads a cover and turns it into a "data:" URL the PDF can embed. Only JPG/PNG are supported. */
async function loadCover(url: string | null): Promise<string | null> {
  if (!url) return null;
  const file = await fetchBytes(url);
  if (!file) return null;
  const type = file.type.includes("png") ? "image/png" : file.type.includes("jpeg") || file.type.includes("jpg") ? "image/jpeg" : null;
  if (!type) return null;
  let binary = "";
  for (let i = 0; i < file.bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...file.bytes.subarray(i, i + 0x8000)); // in chunks: huge arguments lists crash
  }
  return `data:${type};base64,${btoa(binary)}`;
}

// ---------------------------------------------------------------- layout

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, color: C.text, fontFamily: "Helvetica", fontSize: 9.5, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44 },
  kicker: { fontSize: 7.5, letterSpacing: 2.5, color: C.muted, textTransform: "uppercase" },
  title: { fontFamily: "Anton", fontSize: 46, textTransform: "uppercase", marginTop: 6, lineHeight: 1.35 },
  subtitle: { fontSize: 8.5, letterSpacing: 1.5, color: C.muted, textTransform: "uppercase", marginTop: 6 },
  rule: { height: 2, width: 44, backgroundColor: C.brand, marginTop: 14, marginBottom: 22 },
  entry: { flexDirection: "row", gap: 14, paddingVertical: 12, borderBottomWidth: 0.75, borderBottomColor: C.faint },
  cover: { width: 62, height: 93, borderRadius: 4, objectFit: "cover" },
  coverEmpty: { width: 62, height: 93, borderRadius: 4, backgroundColor: "#141414" },
  body: { flex: 1 },
  entryTitle: { fontFamily: "Anton", fontSize: 15, textTransform: "uppercase", lineHeight: 1.15 },
  meta: { color: C.muted, marginTop: 2 },
  platforms: { color: "#5f5f5f", fontSize: 8, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7 },
  pill: { fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: C.text, borderWidth: 0.75, borderColor: "#444", borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 7 },
  ratingText: { fontFamily: "Anton", fontSize: 11 },
  comment: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: C.brand, color: "#cfcfcf", fontFamily: "Helvetica-Oblique", lineHeight: 1.45 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#5f5f5f" },
  empty: { color: C.muted, marginTop: 20 },
});

function LibraryDocument({ items, covers, options }: { items: LibraryItem[]; covers: (string | null)[]; options: ExportOptions }) {
  const type = items[0]?.type ?? "movie";
  const noun = type === "movie" ? "movie" : "game";
  const date = new Date().toLocaleDateString(undefined, { dateStyle: "medium" });
  const credit =
    type === "movie"
      ? "Movie data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB."
      : "Game data from IGDB.com";

  return (
    <Document title={options.title} creator="Media Tracker">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>Media Tracker</Text>
        <Text style={s.title}>{options.title}</Text>
        <Text style={s.subtitle}>
          {items.length} {noun}
          {items.length === 1 ? "" : "s"} · {date}
        </Text>
        <View style={s.rule} />

        {items.length === 0 && <Text style={s.empty}>Nothing to show with these options.</Text>}

        {items.map((item, i) => (
          // wrap={false}: never split one entry across two pages
          <View key={item.id} style={s.entry} wrap={false}>
            {covers[i] ? <Image src={covers[i]!} style={s.cover} /> : <View style={s.coverEmpty} />}
            <View style={s.body}>
              <Text style={s.entryTitle}>{item.title}</Text>
              <Text style={s.meta}>{[item.year, item.genres.slice(0, 3).join(" · ")].filter(Boolean).join("  —  ")}</Text>
              {item.extra.platforms && item.extra.platforms.length > 0 && (
                <Text style={s.platforms}>{item.extra.platforms.join(", ")}</Text>
              )}
              <View style={s.row}>
                <Text style={s.pill}>{item.status}</Text>
                {item.rating !== null && <Stars rating={item.rating} />}
                {item.favorite && <HeartIcon />}
              </View>
              {options.includeComments && item.notes.trim() !== "" && <Text style={s.comment}>{item.notes.trim()}</Text>}
            </View>
          </View>
        ))}

        {/* fixed: repeated at the bottom of every page */}
        <View style={s.footer} fixed>
          <Text>{credit}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// The built-in PDF fonts have no ★ or ♥ characters, so we draw them as small vector shapes.
const STAR = "5,0 6.18,3.38 9.76,3.45 6.9,5.62 7.94,9.05 5,7 2.06,9.05 3.1,5.62 0.24,3.45 3.82,3.38";

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 1.5 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <Svg key={i} width={7} height={7} viewBox="0 0 10 10">
          <Polygon points={STAR} fill={i < rating ? C.brand : "#333333"} />
        </Svg>
      ))}
      <Text style={[s.ratingText, { marginLeft: 5 }]}>
        {rating}
        <Text style={{ color: C.muted, fontSize: 8 }}>/10</Text>
      </Text>
    </View>
  );
}

function HeartIcon() {
  return (
    <Svg width={10} height={9} viewBox="0 0 24 22">
      <Path
        d="M12 21.6 10.3 20C4.2 14.5 0 10.7 0 6 0 2.6 2.6 0 6 0c1.9 0 3.8.9 5 2.3C13.2.9 15.1 0 17 0c3.4 0 6 2.6 6 6 0 4.7-4.2 8.5-10.3 14L12 21.6z"
        fill={C.brand}
      />
    </Svg>
  );
}
