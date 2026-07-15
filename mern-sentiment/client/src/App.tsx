import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { AuthModal } from "./components/AuthModal";
import { DashboardOverview } from "./pages/DashboardOverview";
import { TextAnalysisPage } from "./pages/TextAnalysisPage";
import { ImageAnalysisPage } from "./pages/ImageAnalysisPage";
import { AudioAnalysisPage } from "./pages/AudioAnalysisPage";
import { MultimodalAnalysisPage } from "./pages/MultimodalAnalysisPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardOverview onNavigate={setActiveTab} />;
      case "text":
        return <TextAnalysisPage />;
      case "image":
        return <ImageAnalysisPage />;
      case "audio":
        return <AudioAnalysisPage />;
      case "multimodal":
        return <MultimodalAnalysisPage />;
      case "history":
        return <HistoryPage />;
      case "analytics":
        return <AnalyticsPage />;
      default:
        return <DashboardOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Navbar onOpenAuth={() => setIsAuthOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[calc(100vh-61px)]">
          {renderContent()}
        </main>
      </div>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};
