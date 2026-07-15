import React from "react";
import { useAuth } from "../context/AuthContext";
import { Sun, Moon, ShieldCheck, LogOut, User as UserIcon } from "lucide-react";

interface NavbarProps {
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth }) => {
  const { user, logout, darkMode, setDarkMode } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
          M
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            Multimodal AI Sentiment Engine
            <span className="text-[10px] bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border border-primary-200 dark:border-primary-800">
              PyTorch + MERN
            </span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time fusion across Social Media Text, Vision, and Audio
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={() => setDarkMode(prev => !prev)}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Toggle Dark Mode"
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>

        {user ? (
          <div className="flex items-center space-x-3 pl-3 border-l border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800/80 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
              <UserIcon className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
              {user.role === "admin" && (
                <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">
                  ADMIN
                </span>
              )}
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm shadow-sm transition-all flex items-center space-x-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </header>
  );
};
