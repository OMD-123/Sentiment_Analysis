import React from "react";

interface ProbabilityBarProps {
  scores: {
    Negative: number;
    Neutral: number;
    Positive: number;
  };
  confidence: number;
  sentiment: string;
}

export const ProbabilityBar: React.FC<ProbabilityBarProps> = ({ scores, confidence, sentiment }) => {
  const getBadgeColor = (s: string) => {
    if (s === "Positive") return "bg-emerald-500 text-white shadow-emerald-500/25";
    if (s === "Negative") return "bg-rose-500 text-white shadow-rose-500/25";
    return "bg-amber-500 text-white shadow-amber-500/25";
  };

  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1">
            Predicted Sentiment
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-md ${getBadgeColor(sentiment)}`}>
            {sentiment}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1">
            Confidence Score
          </span>
          <span className="text-2xl font-black text-gray-900 dark:text-white">
            {(confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block">Class Probability Distribution</span>
        
        {/* Positive */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Positive</span>
            <span>{(scores.Positive * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, scores.Positive * 100))}%` }}></div>
          </div>
        </div>

        {/* Neutral */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-amber-600 dark:text-amber-400 font-bold">Neutral</span>
            <span>{(scores.Neutral * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, scores.Neutral * 100))}%` }}></div>
          </div>
        </div>

        {/* Negative */}
        <div>
          <div className="flex justify-between text-xs font-medium mb-1">
            <span className="text-rose-600 dark:text-rose-400 font-bold">Negative</span>
            <span>{(scores.Negative * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, scores.Negative * 100))}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
