import React, { useState } from "react";
import { predictText } from "../services/api";
import { ProbabilityBar } from "../components/ProbabilityBar";
import { MessageSquare, Sparkles, Send, CheckCircle2 } from "lucide-react";

export const TextAnalysisPage: React.FC = () => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const sampleTexts = [
    "I absolutely love this new update! The UI is incredibly smooth and responsive. Best experience ever!",
    "The package arrived on Tuesday at 3 PM as scheduled via courier service.",
    "I am completely disappointed with the customer support. Nobody answers after waiting an hour!"
  ];

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const pred = await predictText(text);
      setResult(pred);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
        <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 font-bold text-sm uppercase tracking-wider">
          <MessageSquare className="w-4 h-4" />
          <span>Natural Language Modality</span>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
          Social Media Tweet & Text Sentiment Analysis
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Powered by a fine-tuned 1D-Transformer feature extractor trained on the CardiffNLP TweetEval benchmark.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Input Tweet or Text
                </label>
                <span className="text-[11px] text-gray-400">{text.length}/500 chars</span>
              </div>
              <textarea
                rows={5}
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste a social media post, comment, or review here..."
                className="w-full p-4 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none"
              ></textarea>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 block">Quick Benchmark Samples:</span>
              <div className="flex flex-wrap gap-2">
                {sampleTexts.map((st, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setText(st)}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 hover:bg-primary-50 dark:hover:bg-primary-900/40 hover:text-primary-600 dark:hover:text-primary-300 transition-all text-left truncate max-w-xs font-medium border border-transparent hover:border-primary-300"
                  >
                    Sample {i + 1}: {st.slice(0, 30)}...
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? "Analyzing via PyTorch..." : "Analyze Text Sentiment"}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 flex flex-col justify-start">
          {result ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Real-Time Inference Complete</span>
              </div>
              <ProbabilityBar
                scores={result.probabilityScores || result.probability_scores}
                confidence={result.confidence}
                sentiment={result.sentiment}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-dashed border-gray-300 dark:border-gray-700 h-full flex flex-col items-center justify-center text-center space-y-3">
              <Sparkles className="w-8 h-8 text-primary-400 animate-pulse" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Awaiting Prediction</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Enter your text and press analyze to view probability breakdowns and confidence scores.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
