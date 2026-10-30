import { HashRouter, Route, Routes } from "react-router";
import { OpeningMenu } from "@/pages/OpeningMenu";
import { LibraryPlaceholder } from "@/pages/LibraryPlaceholder";

// HashRouter keeps routes working when Tauri loads the built files from disk.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<OpeningMenu />} />
        <Route path="/movies" element={<LibraryPlaceholder title="Movies" />} />
        <Route path="/games" element={<LibraryPlaceholder title="Games" />} />
      </Routes>
    </HashRouter>
  );
}
