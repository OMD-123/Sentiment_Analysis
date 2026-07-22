import React, { useState } from "react";
import { predictImage } from "../services/api";
import { ProbabilityBar } from "../components/ProbabilityBar";
import { Image as ImageIcon, UploadCloud, Sparkles, CheckCircle2 } from "lucide-react";

export const ImageAnalysisPage: React.FC = () => {
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
      const pred = await predictImage(file);
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
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm uppercase tracking-wider">
          <ImageIcon className="w-4 h-4" />
          <span>Visual Modality</span>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
          Social Media Image Sentiment Analysis
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Fine-tuned CNN/ViT architecture trained on the FI (Flickr &amp; Instagram) visual emotion dataset.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Upload Image File (JPG, PNG, WEBP)
              </label>
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl cursor-pointer hover:border-primary-500 dark:hover:border-primary-500 transition-all bg-gray-50 dark:bg-gray-900/50">
                {preview ? (
                  <div className="flex flex-col items-center space-y-3">
                    <img src={preview} alt="Preview" className="max-h-48 rounded-xl object-contain shadow-md border border-gray-200 dark:border-gray-700" />
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{file?.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2 py-4">
                    <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Click to upload image</span>
                    <span className="text-xs text-gray-400">Standard formats supported up to 25MB</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
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
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Extracting Visual Features..." : "Analyze Image Sentiment"}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 flex flex-col justify-start">
          {result ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Image Inference Complete</span>
              </div>
              <ProbabilityBar
                scores={result.probabilityScores || result.probability_scores}
                confidence={result.confidence}
                sentiment={result.sentiment}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-dashed border-gray-300 dark:border-gray-700 h-full flex flex-col items-center justify-center text-center space-y-3">
              <ImageIcon className="w-8 h-8 text-indigo-400 animate-pulse" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Awaiting Visual Input</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Upload a social media image and trigger inference to inspect visual sentiment scores.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
