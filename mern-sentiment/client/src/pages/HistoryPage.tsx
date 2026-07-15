import React, { useEffect, useState } from "react";
import { getPredictionHistory, deletePredictionHistory, PredictionHistoryItem } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { History, Trash2, Search, Filter, Eye, RefreshCw, Layers } from "lucide-react";

export const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModality, setFilterModality] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<PredictionHistoryItem | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getPredictionHistory(100);
      setHistory(data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this prediction history record?")) return;
    try {
      await deletePredictionHistory(id);
      setHistory(prev => prev.filter(item => (item._id || item.id) !== id));
    } catch (err) {
      alert("Failed to delete item or insufficient permissions.");
    }
  };

  const filteredHistory = history.filter(item => {
    if (filterModality !== "all" && item.modality !== filterModality) return false;
    if (searchQuery) {
      const text = item.inputs?.text || item.inputs?.imagePath || item.inputs?.audioPath || "";
      if (!text.toLowerCase().includes(searchQuery.toLowerCase()) && !item.sentiment.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const getBadgeColor = (s: string) => {
    if (s === "Positive") return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    if (s === "Negative") return "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30";
    return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 font-bold text-sm uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Audit & Telemetry Logs</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
            Prediction History & Inference Archive
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Persistent MongoDB record of all analyzed text, vision, speech, and multimodal predictions.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center space-x-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search input text, file, or sentiment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {["all", "text", "image", "audio", "multimodal"].map((mod) => (
            <button
              key={mod}
              onClick={() => setFilterModality(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex-shrink-0 ${
                filterModality === mod
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3.5">Modality</th>
                <th className="px-6 py-3.5">Input Snippet</th>
                <th className="px-6 py-3.5">Sentiment</th>
                <th className="px-6 py-3.5">Confidence</th>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-xs font-medium">
                    Loading prediction records...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-xs font-medium">
                    No prediction records matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item, idx) => {
                  const id = item._id || item.id || String(idx);
                  return (
                    <tr
                      key={id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3.5 font-bold uppercase text-xs tracking-wider text-gray-700 dark:text-gray-300">
                        <span className="px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          {item.modality}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-gray-800 dark:text-gray-200 max-w-xs truncate">
                        {item.inputs?.text || item.inputs?.imagePath || item.inputs?.audioPath || "Multimodal Input"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getBadgeColor(item.sentiment)}`}>
                          {item.sentiment}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-black text-gray-900 dark:text-white">
                        {(item.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-3.5 text-xs text-gray-500">
                        {new Date(item.createdAt || Date.now()).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                          className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-primary-600"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {user && (
                          <button
                            onClick={(e) => handleDelete(id, e)}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Prediction Record Details
              </span>
              <button onClick={() => setSelectedItem(null)} className="text-xs font-bold text-gray-400 hover:text-gray-600">
                Close [X]
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-gray-500 block mb-0.5">Modality Type:</span>
                <span className="font-semibold text-gray-900 dark:text-white uppercase">{selectedItem.modality}</span>
              </div>
              <div>
                <span className="font-bold text-gray-500 block mb-0.5">Analyzed Input Data:</span>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono break-all">
                  {JSON.stringify(selectedItem.inputs, null, 2)}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-500">Predicted Sentiment:</span>
                <span className={`px-3 py-1 rounded-full font-bold ${getBadgeColor(selectedItem.sentiment)}`}>
                  {selectedItem.sentiment} ({(selectedItem.confidence * 100).toFixed(1)}%)
                </span>
              </div>
              <div>
                <span className="font-bold text-gray-500 block mb-1">Class Probabilities Breakdown:</span>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 font-mono text-[11px] space-y-1">
                  {selectedItem.probabilityScores && Object.keys(selectedItem.probabilityScores).map((k) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}:</span>
                      <span className="font-bold">{((selectedItem.probabilityScores as any)[k] * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
