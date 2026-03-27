import { useState, useEffect } from 'react';
import { DocumentLibrary } from './DocumentLibrary';

interface BatchDocument {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  balances: {
    beginning_balance: { amount: number | null };
    ending_balance: { amount: number | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
  } | null;
}

interface Batch {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  total_documents: number;
  completed_documents: number;
  documents: BatchDocument[];
}

interface BatchProcessorProps {
  onComplete?: () => void;
}

export function BatchProcessor({ onComplete }: BatchProcessorProps) {
  const [step, setStep] = useState<'select' | 'review' | 'processing' | 'complete'>('select');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [documents] = useState<BatchDocument[]>([]);

  useEffect(() => {
    if (step === 'processing' && batch) {
      pollProgress();
    }
  }, [step, batch]);

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleCreateBatch = () => {
    if (selectedIds.length === 0) return;
    setStep('review');
  };

  const handleStartProcessing = async () => {
    if (selectedIds.length === 0) return;

    setUploading(true);
    try {
      // Simulate batch creation and processing start
      const mockBatch: Batch = {
        id: Date.now(),
        name: batchName || `Batch ${new Date().toLocaleDateString()}`,
        status: 'processing',
        total_documents: selectedIds.length,
        completed_documents: 0,
        documents: documents.filter(d => selectedIds.includes(d.id))
      };
      setBatch(mockBatch);
      setStep('processing');
    } catch (error) {
      console.error('Failed to create batch:', error);
    } finally {
      setUploading(false);
    }
  };

  const pollProgress = async () => {
    if (!batch) return;

    // Simulate progress
    const interval = setInterval(() => {
      setBatch(prev => {
        if (!prev) return prev;

        const newCompleted = Math.min(prev.completed_documents + 1, prev.total_documents);
        const updated = {
          ...prev,
          completed_documents: newCompleted,
          status: newCompleted >= prev.total_documents ? 'complete' as const : 'processing' as const,
          documents: prev.documents.map((d, i) => ({
            ...d,
            status: i < newCompleted ? 'complete' as const : d.status
          }))
        };

        if (updated.status === 'complete') {
          clearInterval(interval);
          setStep('complete');
          onComplete?.();
        }

        return updated;
      });
    }, 800);

    return () => clearInterval(interval);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-4 h-4 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return <span className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getRiskLevel = (score: number | undefined) => {
    if (score === undefined) return { level: 'unknown', color: 'text-gray-400' };
    if (score >= 7) return { level: 'Low', color: 'text-green-600' };
    if (score >= 4) return { level: 'Medium', color: 'text-yellow-600' };
    return { level: 'High', color: 'text-red-600' };
  };

  const handleReset = () => {
    setStep('select');
    setSelectedIds([]);
    setBatch(null);
    setBatchName('');
  };

  // Step 1: Document Selection
  if (step === 'select') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Document Library</h2>
            <p className="text-sm text-gray-500 mt-1">
              Select documents to process in a batch (max 50)
            </p>
          </div>
          <div className="text-sm">
            <span className="font-medium">{selectedIds.length}</span>
            <span className="text-gray-500"> selected</span>
          </div>
        </div>

        <DocumentLibrary
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          selectionMode={true}
        />

        {selectedIds.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleCreateBatch}
                  disabled={selectedIds.length === 0}
                  className="px-6 py-3 bg-black text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Process {selectedIds.length} Document{selectedIds.length !== 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-4 py-2 text-gray-600 hover:text-black"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 2: Review Batch
  if (step === 'review') {
    const selectedDocs = documents.filter(d => selectedIds.includes(d.id));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Review Batch</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedIds.length} document{selectedIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Batch Name (optional)
            </label>
            <input
              type="text"
              value={batchName}
              onChange={e => setBatchName(e.target.value)}
              placeholder={`Batch ${new Date().toLocaleDateString()}`}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Selected Documents</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-sm">{doc.filename}</span>
                  </div>
                  <button
                    onClick={() => setSelectedIds(prev => prev.filter(i => i !== doc.id))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleStartProcessing}
            disabled={uploading || selectedIds.length === 0}
            className="px-6 py-3 bg-black text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Starting...' : 'Start Processing'}
          </button>
          <button
            onClick={() => setStep('select')}
            className="px-4 py-2 text-gray-600 hover:text-black"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Processing
  if (step === 'processing' && batch) {
    const progress = Math.round((batch.completed_documents / batch.total_documents) * 100);
    const failedCount = batch.documents.filter(d => d.status === 'failed').length;
    const completeCount = batch.documents.filter(d => d.status === 'complete').length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{batch.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Batch Processing in Progress
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{progress}%</div>
            <div className="text-sm text-gray-500">
              {batch.completed_documents}/{batch.total_documents} complete
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <div className="flex items-center gap-4 text-sm">
              {completeCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {completeCount}
                </span>
              )}
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {failedCount}
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Document Status Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ending Balance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batch.documents.map((doc) => {
                const risk = getRiskLevel(doc.ai_analysis?.qualification_score);
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{doc.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(doc.status)}
                        <span className={`text-sm capitalize ${
                          doc.status === 'complete' ? 'text-green-600' :
                          doc.status === 'failed' ? 'text-red-600' :
                          doc.status === 'processing' ? 'text-yellow-600' :
                          'text-gray-500'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {doc.balances?.ending_balance?.amount
                        ? `$${doc.balances.ending_balance.amount.toLocaleString()}`
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${risk.color}`}>
                        {risk.level}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Step 4: Complete
  if (step === 'complete' && batch) {
    const completeCount = batch.documents.filter(d => d.status === 'complete').length;
    const failedCount = batch.documents.filter(d => d.status === 'failed').length;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Batch Complete</h2>
          <p className="text-gray-500 mb-6">{batch.name}</p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{completeCount}</div>
              <div className="text-sm text-gray-500">Successful</div>
            </div>
            {failedCount > 0 && (
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{failedCount}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-black text-white font-semibold rounded-lg"
            >
              Process More Documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
