import { useState, useCallback } from 'react';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

interface AnalysisResult {
  word_count: number;
  char_count: number;
  has_pii_indicators: boolean;
  confidence_score: number;
}

export function UploadSection() {
  const { colors } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrubbedText, setScrubbedText] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setResult(null);
        setScrubbedText('');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setScrubbedText('');
    }
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('remove_pii', 'true');

    try {
      const response = await axios.post('/api/v1/pdf/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data.analysis);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrub = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('remove_pii', 'true');

    try {
      const response = await axios.post('/api/v1/pdf/scrub', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setScrubbedText(response.data.scrubbed_text);
    } catch (error) {
      console.error('Scrub failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Premium Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200 ${
          dragActive
            ? 'border-black bg-bw-50 scale-[1.02]'
            : 'border-bw-200 hover:border-bw-400'
        }`}
        style={{ backgroundColor: colors.bg }}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto border-2 border-bw-300 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-bw-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-lg font-medium text-bw-900 mb-2">
            {dragActive ? 'Release to drop' : 'Drop PDF or click to select'}
          </p>
          <p className="text-sm text-bw-400">
            PDF files only, any size accepted
          </p>
          {file && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-bw-50 rounded-lg border border-bw-100">
              <svg className="w-4 h-4 text-bw-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-bw-700">{file.name}</span>
            </div>
          )}
        </label>
      </div>

      {/* Action Buttons */}
      {file && (
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-8 py-3 bg-black text-white text-sm font-semibold rounded-lg transition-all duration-150 hover:bg-bw-800 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
          >
            {loading ? 'Analyzing...' : 'Analyze PDF'}
          </button>
          <button
            onClick={handleScrub}
            disabled={loading}
            className="px-8 py-3 bg-white text-bw-900 text-sm font-semibold rounded-lg border-2 border-bw-900 transition-all duration-150 hover:bg-bw-50 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
          >
            {loading ? 'Scrubbing...' : 'Scrub PDF'}
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {result && (
        <div className="bg-white rounded-xl p-8 border border-bw-100 shadow-card">
          <h3 className="text-xs font-semibold tracking-wide uppercase text-bw-500 mb-6">Analysis Results</h3>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-xs text-bw-400 uppercase tracking-wider">Word Count</p>
              <p className="text-4xl font-light text-bw-900">{result.word_count.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-bw-400 uppercase tracking-wider">Character Count</p>
              <p className="text-4xl font-light text-bw-900">{result.char_count.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-bw-400 uppercase tracking-wider">PII Indicators</p>
              <p className="text-4xl font-light text-bw-900">
                {result.has_pii_indicators ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-bw-400 uppercase tracking-wider">Confidence</p>
              <p className="text-4xl font-light text-bw-900">
                {(result.confidence_score * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scrubbed Text */}
      {scrubbedText && (
        <div className="bg-white rounded-xl p-8 border border-bw-100 shadow-card">
          <h3 className="text-xs font-semibold tracking-wide uppercase text-bw-500 mb-6">Scrubbed Output</h3>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-bw-700 bg-bw-50 p-6 rounded-lg border border-bw-100 overflow-auto max-h-80 font-mono">
            {scrubbedText}
          </pre>
        </div>
      )}
    </div>
  );
}
