import React, { useState } from "react";
import { predictAudio } from "../services/api";
import { ProbabilityBar } from "../components/ProbabilityBar";
import { Mic, UploadCloud, Sparkles, CheckCircle2 } from "lucide-react";

export const AudioAnalysisPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
      setError("");
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const pred = await predictAudio(file);
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
        <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-sm uppercase tracking-wider">
          <Mic className="w-4 h-4" />
          <span>Speech Emotion Modality</span>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
          Audio Waveform & Mel-Spectrogram Sentiment
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Analyzes acoustic dynamics and frequency spectrum features using our 2D-CNN speech emotion recognizer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Upload Audio File (WAV, MP3, OGG, FLAC)
              </label>
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl cursor-pointer hover:border-amber-500 dark:hover:border-amber-500 transition-all bg-gray-50 dark:bg-gray-900/50">
                {preview ? (
                  <div className="flex flex-col items-center space-y-3 w-full">
                    <audio src={preview} controls className="w-full max-w-xs" />
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 truncate max-w-xs">{file?.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2 py-4">
                    <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Click to upload speech audio</span>
                    <span className="text-xs text-gray-400">WAV or MP3 recommended up to 25MB</span>
                  </div>
                )}
                <input type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Extracting Mel-Spectrogram..." : "Analyze Audio Emotion"}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 flex flex-col justify-start">
          {result ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Audio Inference Complete</span>
              </div>
              <ProbabilityBar
                scores={result.probabilityScores || result.probability_scores}
                confidence={result.confidence}
                sentiment={result.sentiment}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-dashed border-gray-300 dark:border-gray-700 h-full flex flex-col items-center justify-center text-center space-y-3">
              <Mic className="w-8 h-8 text-amber-400 animate-pulse" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Awaiting Audio Input</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Upload a recorded voice clip or speech sample to evaluate emotion classification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
