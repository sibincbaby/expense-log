import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import HeaderBar from "./HeaderBar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import TransactionForm from "./TransactionForm";
import { useTransactions } from "@/context/TransactionContext";

const Layout = () => {
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const { refreshTransactions } = useTransactions();
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem("geminiApiKey") || "AIzaSyDo5DOhvf50mKAEWEkyAGmD3VJlIyCKphk";
  });
  const [claudeApiKey, setClaudeApiKey] = useState(() => {
    return localStorage.getItem("claudeApiKey") || "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";
  });
  const [useClaudeApi, setUseClaudeApi] = useState(() => {
    return localStorage.getItem("useClaudeApi") === "true";
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Update the API keys if they change in localStorage
    const handleModelChange = () => {
      const updatedUseClaudeApi = localStorage.getItem("useClaudeApi") === "true";
      const updatedGeminiApiKey = localStorage.getItem("geminiApiKey") || "AIzaSyDo5DOhvf50mKAEWEkyAGmD3VJlIyCKphk";
      const updatedClaudeApiKey = localStorage.getItem("claudeApiKey") || "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";
      
      setUseClaudeApi(updatedUseClaudeApi);
      setGeminiApiKey(updatedGeminiApiKey);
      setClaudeApiKey(updatedClaudeApiKey);
      
      console.log(`Model updated in Layout: ${updatedUseClaudeApi ? "Claude" : "Gemini"}`);
    };

    // Create a custom event for model changes
    window.addEventListener("model-change", handleModelChange);
    
    // Cleanup
    return () => {
      window.removeEventListener("model-change", handleModelChange);
    };
  }, []);

  // Function to handle "+" button click from bottom nav
  const handleAddClick = () => {
    setIsAddTransactionOpen(true);
  };
  
  // Function to handle transaction added, close drawer and refresh data
  const handleTransactionAdded = () => {
    setIsAddTransactionOpen(false);
    refreshTransactions(); // Trigger a refresh in all components that are listening
  };

  // Function to handle profile icon click
  const handleProfileClick = () => {
    navigate('/more');
  };

  return (
    <div className="relative min-h-screen pb-[calc(60px+env(safe-area-inset-bottom))] md:pb-16 bg-white transition-colors duration-300">
      {/* Header Bar */}
      <HeaderBar onProfileClick={handleProfileClick} />
      
      {/* Main content - add top padding to account for fixed header */}
      <div className="container max-w-md mx-auto content-padding py-4 pt-[calc(3.5rem+0.5rem)] animate-fade-in">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <BottomNav onAddClick={handleAddClick} />

      {/* Add Transaction Drawer */}
      <Drawer open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
        <DrawerContent className="px-4 pb-8 pt-4 rounded-t-xl shadow-elevation-3 transition-all duration-300">
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader className="text-center">
              <DrawerTitle className="text-xl font-semibold text-[hsl(var(--primary))]">Add New Transaction</DrawerTitle>
            </DrawerHeader>
            <TransactionForm
              apiKey={geminiApiKey}
              claudeApiKey={claudeApiKey}
              useClaudeApi={useClaudeApi}
              onTransactionAdded={handleTransactionAdded}
              showTitle={false}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Layout;