import React, { useState } from "react";
import { BarChart3, Settings, Home, Menu, Bot } from "lucide-react";
import MultiPairChart from "./trading/MultiPairChart";
import Predictions from "./AI/Predictions";
import MorePredictions from "./AI/MorePredictions";
import NewsFeed from "./trading/NewsFeed";
import TradingTrainer from "./trading/TradingTrainer";
import StrategyPanel from "./AI/StrategyPanel";

export default function DashboardLayout() {
  const [activeMenu, setActiveMenu] = useState("trading");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-60" : "w-16"
        } bg-gray-800 flex flex-col transition-all duration-300 border-r border-gray-700`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h1 className={`text-xl font-bold ${sidebarOpen ? "block" : "hidden"}`}>
            DEFI Dashboard
          </h1>
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="p-1 rounded hover:bg-gray-700"
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => setActiveMenu("home")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "home" ? "bg-gray-700" : ""
            }`}
          >
            <Home size={18} />
            {sidebarOpen && <span>Home</span>}
          </button>

          <button
            onClick={() => setActiveMenu("trading")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "trading" ? "bg-gray-700" : ""
            }`}
          >
            <BarChart3 size={18} />
            {sidebarOpen && <span>Trading App</span>}
          </button>

          <button
            onClick={() => setActiveMenu("ai")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "ai" ? "bg-gray-700" : ""
            }`}
          >
            <Bot size={18} />
            {sidebarOpen && <span>AI Predictions</span>}
          </button>

          <button
            onClick={() => setActiveMenu("moreai")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "moreai" ? "bg-gray-700" : ""
            }`}
          >
            <BarChart3 size={18} />
            {sidebarOpen && <span>More Predictions</span>}
          </button>

          <button
            onClick={() => setActiveMenu("newsfeed")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "newsfeed" ? "bg-gray-700" : ""
            }`}
          >
            <BarChart3 size={18} />
            {sidebarOpen && <span>News feed</span>}
          </button>

          <button
            onClick={() => setActiveMenu("strategy")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "strategy" ? "bg-gray-700" : ""
            }`}
          >
            <BarChart3 size={18} />
            {sidebarOpen && <span>Strategy Panel</span>}
          </button>

          <button
            onClick={() => setActiveMenu("TradingTrainer")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "strategy" ? "bg-gray-700" : ""
            }`}
          >
            <BarChart3 size={18} />
            {sidebarOpen && <span>Trading Training</span>}
          </button>

          <button
            onClick={() => setActiveMenu("Learn")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "strategy" ? "bg-gray-700" : ""
            }`}
          >
            <BarChart3 size={18} />
            {sidebarOpen && <span>Learn</span>}
          </button>

          <button
            onClick={() => setActiveMenu("settings")}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-700 ${
              activeMenu === "settings" ? "bg-gray-700" : ""
            }`}
          >
            <Settings size={18} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {activeMenu === "home" && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Kuber's DEFI Kingdom Website</h2>
            <p className="text-gray-400">
              Choose “Trading App” from the sidebar to open your trading dashboard.
            </p>
          </div>
        )}

        {activeMenu === "trading" && (
          <div className="p-4">
            <MultiPairChart />
          </div>
        )}

        {activeMenu === "ai" && <Predictions />}
        {activeMenu === "moreai" && <MorePredictions />}
        {activeMenu === "newsfeed" && <NewsFeed />}
        {activeMenu === "strategy" && <StrategyPanel />}
        {activeMenu === "TradingTrainer" && <TradingTrainer />}

        {activeMenu === "settings" && (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <p className="text-gray-400">Adjust preferences here.</p>
          </div>
        )}
      </main>
    </div>
  );
}
