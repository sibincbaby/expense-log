import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/Layout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "./components/theme-provider";
import { TransactionProvider } from "./context/TransactionContext";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import HomePage from "./pages/HomePage";
import TransactionsPage from "./pages/TransactionsPage";
import MorePage from "./pages/MorePage";
import NotFoundPage from "./pages/NotFound";
import { warmUpConnection } from "./utils/geminiApi";

// Create React Query client
const queryClient = new QueryClient();

const App: React.FC = () => {
  // Load API keys from localStorage and warm up the connection
  useEffect(() => {
    const geminiApiKey =
      localStorage.getItem("geminiApiKey") ||
      "AIzaSyDo5DOhvf50mKAEWEkyAGmD3VJlIyCKphk";
    const claudeApiKey = localStorage.getItem("claudeApiKey") || "";
    const useClaudeApi = localStorage.getItem("useClaudeApi") === "true";

    // Warm up the connection in the background
    warmUpConnection(geminiApiKey, useClaudeApi, claudeApiKey);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TransactionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/more" element={<MorePage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </TransactionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
