import { HashRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { OpeningMenu } from "@/pages/OpeningMenu";
import { LibraryPage } from "@/pages/LibraryPage";
import { SettingsPage } from "@/pages/SettingsPage";

// One shared cache for all data fetching (API searches, library, settings).
const queryClient = new QueryClient();

// HashRouter keeps routes working when Tauri loads the built files from disk.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<OpeningMenu />} />
          <Route path="/movies" element={<LibraryPage key="movie" type="movie" />} />
          <Route path="/games" element={<LibraryPage key="game" type="game" />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </HashRouter>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
