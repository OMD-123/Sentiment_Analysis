import React from "react";
import { LayoutDashboard, MessageSquare, Image as ImageIcon, Mic, Layers, History, BarChart3 } from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "text", label: "Text Analysis", icon: MessageSquare },
    { id: "image", label: "Image Analysis", icon: ImageIcon },
    { id: "audio", label: "Audio Analysis", icon: Mic },
    { id: "multimodal", label: "Multimodal Fusion", icon: Layers, highlight: true },
    { id: "history", label: "Prediction History", icon: History },
    { id: "analytics", label: "Analytics & Reports", icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col justify-between p-4 flex-shrink-0 min-h-[calc(100vh-61px)]">
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-500 mb-2">
          Navigation & Modalities
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? "bg-primary-600 text-white shadow-md shadow-primary-500/20"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : item.highlight ? "text-primary-500" : "text-gray-500 dark:text-gray-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.highlight && !isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 font-bold">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-primary-500/10 border border-indigo-500/20 dark:border-indigo-500/30">
        <div className="flex items-center space-x-2 mb-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">State-of-the-Art Models</span>
        </div>
        <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
          Trained with PyTorch on CardiffNLP TweetEval, FI (Flickr &amp; Instagram), and RAVDESS Speech Emotion datasets.
        </p>
      </div>
    </aside>
  );
};
