import React, { useState } from "react";
import { predictMultimodal } from "../services/api";
import { ProbabilityBar } from "../components/ProbabilityBar";
import { Layers, MessageSquare, Image as ImageIcon, Mic, Sparkles, CheckCircle2, Cpu } from "lucide-react";

export const MultimodalAnalysisPage: React.FC = () => {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setImageFile(f);
      setImagePreview(URL.createObjectURL(f));
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setAudioFile(f);
      setAudioPreview(URL.createObjectURL(f));
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageFile && !audioFile) {
      setError("Please provide at least one modality (Text, Image, or Audio) to run fusion.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const pred = await predictMultimodal({
        text: text.trim() || undefined,
        image: imageFile || undefined,
        audio: audioFile || undefined
      });
      setResult(pred);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Multimodal prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-primary-900/90 rounded-2xl p-6 text-white shadow-xl space-y-2 border border-purple-500/30">
        <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>Cross-Modal Attention Layer Architecture</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight">
          Attention-Based & Weighted Late Multimodal Fusion
        </h2>
        <p className="text-xs text-purple-200 max-w-3xl leading-relaxed">
          Combines token embeddings `[B, 512]` from Text, Vision, and Acoustic models using Multi-Head Self-Attention.
          Missing modalities are dynamically masked out (`gate_scores.masked_fill`), ensuring high accuracy whether you provide 1, 2, or all 3 inputs simultaneously.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Modality 1: Text */}
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-primary-500 font-bold text-xs uppercase tracking-wider mb-2">
                <MessageSquare className="w-4 h-4" />
                <span>Text Input</span>
              </div>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter social media post or comment..."
                className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none"
              ></textarea>
            </div>
            <span className="text-[11px] text-gray-400">Optional or combine with Image/Audio</span>
          </div>

          {/* Modality 2: Image */}
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-indigo-500 font-bold text-xs uppercase tracking-wider mb-2">
                <ImageIcon className="w-4 h-4" />
                <span>Visual Input</span>
              </div>
              <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500 transition-all bg-gray-50 dark:bg-gray-900/50 p-2">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full rounded-lg object-contain" />
                ) : (
                  <span className="text-xs font-semibold text-gray-500 text-center">Click to attach image file</span>
                )}
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>
            {imageFile && (
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="text-[11px] text-red-500 font-bold hover:underline"
              >
                Remove Image ({imageFile.name})
              </button>
            )}
          </div>

          {/* Modality 3: Audio */}
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 text-amber-500 font-bold text-xs uppercase tracking-wider mb-2">
                <Mic className="w-4 h-4" />
                <span>Audio Input</span>
              </div>
              <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-amber-500 transition-all bg-gray-50 dark:bg-gray-900/50 p-2">
                {audioPreview ? (
                  <audio src={audioPreview} controls className="w-full max-w-[200px]" />
                ) : (
                  <span className="text-xs font-semibold text-gray-500 text-center">Click to attach voice/audio file</span>
                )}
                <input type="file" accept="audio/*" onChange={handleAudioChange} className="hidden" />
              </label>
            </div>
            {audioFile && (
              <button
                type="button"
                onClick={() => { setAudioFile(null); setAudioPreview(null); }}
                className="text-[11px] text-red-500 font-bold hover:underline"
              >
                Remove Audio ({audioFile.name})
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!text.trim() && !imageFile && !audioFile)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-extrabold text-base shadow-xl shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center justify-center space-x-2.5"
        >
          <Sparkles className="w-5 h-5 animate-spin" />
          <span>{loading ? "Fusing Multimodal Embeddings in PyTorch..." : "Execute Multimodal Attention Fusion"}</span>
        </button>
      </form>

      {/* Results Breakdown */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn pt-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Fused Prediction Output</span>
            </div>
            <ProbabilityBar
              scores={result.probabilityScores || result.probability_scores}
              confidence={result.confidence}
              sentiment={result.sentiment}
            />

            {/* Attention Weights */}
            {result.attentionWeights && (
              <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
                <span className="text-xs font-bold uppercase text-gray-400 block flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-500" />
                  Gated Attention Modality Weights
                </span>
                <div className="space-y-1.5 text-xs font-medium">
                  <div className="flex justify-between">
                    <span>Text Modality Weight:</span>
                    <span className="font-bold text-primary-500">{((result.attentionWeights.text || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vision Modality Weight:</span>
                    <span className="font-bold text-indigo-500">{((result.attentionWeights.image || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Modality Weight:</span>
                    <span className="font-bold text-amber-500">{((result.attentionWeights.audio || 0) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Individual Modality Breakdown Cards */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Unimodal Sub-Network Breakdowns
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.modalityScores && Object.keys(result.modalityScores).map((mod) => {
                const sub = result.modalityScores[mod];
                return (
                  <div key={mod} className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary-500">
                        {mod} Sub-Model
                      </span>
                      <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                        {(sub.confidence * 100).toFixed(1)}% Conf
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs text-gray-500">Unimodal Prediction:</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                        {sub.sentiment}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
