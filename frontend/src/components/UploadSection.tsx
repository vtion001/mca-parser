import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';
import { useExtractionContext } from '../contexts/ExtractionContext';
import { ExtractionProgress } from './ExtractionProgress';
import { MarkdownViewer } from './MarkdownViewer';
import { KeyDetailsPanel } from './KeyDetailsPanel';
import { ScoreDashboard } from './ScoreDashboard';
import { AnalysisResults } from './AnalysisResults';

interface AnalysisResult {
  word_count: number;
  char_count: number;
  has_pii_indicators: boolean;
  confidence_score: number;
}

export function UploadSection() {
  const { colors } = useTheme();
  const { state, batchResults, startExtraction, startBatchExtraction, reset } = useExtractionContext();
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrubbedText, setScrubbedText] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pdfFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type === 'application/pdf'
      );
      if (pdfFiles.length > 0) {
        setFiles(pdfFiles);
        setResult(null);
        setScrubbedText('');
        reset();
      }
    }
  }, [reset]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pdfFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf'
      );
      if (pdfFiles.length > 0) {
        setFiles(pdfFiles);
        setResult(null);
        setScrubbedText('');
        reset();
      }
    }
  }, [reset]);

  const handleFullExtract = async () => {
    if (!files.length) return;

    if (files.length === 1) {
      startExtraction(files[0]);
    } else {
      // Process all files sequentially with batch extraction
      await startBatchExtraction(files);
    }
  };

  const handleAnalyze = async () => {
    if (!files.length) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
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
    if (!files.length) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', files[0]);
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
        <label htmlFor="file-upload" className="cursor-pointer block w-full" onClick={triggerFileSelect}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
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
            PDF files only, multiple selection supported
          </p>
          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="text-sm font-medium text-bw-700">
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {files.map((f, i) => (
                  <div key={i} className="inline-flex items-center gap-2 px-3 py-1 bg-bw-50 rounded-lg border border-bw-100">
                    <svg className="w-4 h-4 text-bw-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-medium text-bw-700 truncate max-w-[150px]" title={f.name}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </label>
      </div>

      {/* Action Buttons */}
      {files.length > 0 && (
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={handleFullExtract}
            disabled={state.status === 'processing'}
            className="px-8 py-3 bg-black text-white text-sm font-semibold rounded-lg transition-all duration-150 hover:bg-bw-800 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
          >
            {state.status === 'processing'
              ? `Processing (${currentFileIndex(state)})...`
              : files.length === 1
                ? 'Full Extract'
                : `Extract All (${files.length})`}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={loading || state.status === 'processing'}
            className="px-8 py-3 bg-white text-bw-900 text-sm font-semibold rounded-lg border-2 border-bw-900 transition-all duration-150 hover:bg-bw-50 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
          >
            {loading ? 'Analyzing...' : 'Analyze PDF'}
          </button>
          <button
            onClick={handleScrub}
            disabled={loading || state.status === 'processing'}
            className="px-8 py-3 bg-white text-bw-900 text-sm font-semibold rounded-lg border-2 border-bw-900 transition-all duration-150 hover:bg-bw-50 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
          >
            {loading ? 'Scrubbing...' : 'Scrub PDF'}
          </button>
        </div>
      )}

      {/* Extraction Progress */}
      {state.status === 'processing' && (
        <ExtractionProgress
          stageLabel={state.stageLabel}
          progressPercent={state.progressPercent}
          currentMarkdown={state.currentMarkdown}
          stage={state.stage}
        />
      )}

      {/* Batch Results Summary (shown after batch extraction completes) */}
      {state.status === 'complete' && batchResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-bw-700">
              Batch Results — {batchResults.filter(r => r.status === 'complete').length}/{batchResults.length} completed
            </h3>
          </div>
          <div className="space-y-2">
            {batchResults.map((batchResult, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  batchResult.status === 'complete'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                  batchResult.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {batchResult.status === 'complete' ? '✓' : '✗'}
                </span>
                <span className="text-sm font-medium text-bw-700 truncate flex-1" title={batchResult.filename}>
                  {batchResult.filename}
                </span>
                {batchResult.result?.document_type && (
                  <span className="text-xs text-bw-400 capitalize">
                    {batchResult.result.document_type.type.replace('_', ' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extraction Results (single file or last result) */}
      {state.status === 'complete' && state.result && (
        <div className="space-y-6">
          <MarkdownViewer markdown={state.result.markdown} />
          <KeyDetailsPanel
            details={state.result.key_details}
            documentType={state.result.document_type.type}
            typeConfidence={state.result.document_type.confidence}
          />
          <ScoreDashboard
            scores={state.result.scores}
            pii_breakdown={state.result.pii_breakdown}
            recommendations={state.result.recommendations}
          />
          <AnalysisResults result={state.result} />
        </div>
      )}

      {/* Extraction Error */}
      {state.status === 'failed' && (
        <div className="bg-red-50 rounded-xl p-6 border border-red-200">
          <p className="text-red-600 text-sm font-medium">Extraction failed: {state.error}</p>
        </div>
      )}

      {/* Analysis Results (legacy) */}
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

      {/* Scrubbed Text (legacy) */}
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

// Helper to extract batch file counter from stageLabel like "Uploading foo.pdf (2/4)..."
function currentFileIndex(state: { stageLabel: string }): string {
  const match = state.stageLabel.match(/\((\d+)\/(\d+)\)/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return '';
}
