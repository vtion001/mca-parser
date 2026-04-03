import { useState, useEffect } from 'react';
import api from '../services/api';
import { BatchDocumentList } from './batch/BatchDocumentList';
import { BatchCreator } from './batch/BatchCreator';
import { BatchProgress, BatchComplete, Batch } from './batch/BatchProgress';

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
      // Create batch via backend API
      const createResponse = await api.post('/batches', {
        name: batchName || `Batch ${new Date().toLocaleDateString()}`,
        document_ids: selectedIds,
      });

      const createdBatch: Batch = createResponse.data.data;

      // Fetch full batch with documents
      const batchResponse = await api.get(`/batches/${createdBatch.id}`);
      const fullBatch: Batch = batchResponse.data.data;

      setBatch(fullBatch);

      // Start processing via backend API
      await api.post(`/batches/${createdBatch.id}/process`);

      setStep('processing');
    } catch (error) {
      console.error('Failed to create or start batch:', error);
    } finally {
      setUploading(false);
    }
  };

  const pollProgress = async () => {
    if (!batch) return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/batches/${batch.id}/progress`);
        const progressData = response.data.data;

        setBatch(prev => {
          if (!prev) return prev;

          const updated: Batch = {
            ...prev,
            status: progressData.status,
            completed_documents: progressData.completed_documents,
            documents: progressData.documents,
          };

          if (updated.status === 'complete' || updated.status === 'failed') {
            clearInterval(interval);
            setStep('complete');
            onComplete?.();
          }

          return updated;
        });
      } catch (error) {
        console.error('Failed to poll batch progress:', error);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
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
      <BatchDocumentList
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onClearSelection={() => setSelectedIds([])}
        onCreateBatch={handleCreateBatch}
      />
    );
  }

  // Step 2: Review Batch
  if (step === 'review') {
    return (
      <BatchCreator
        batchName={batchName}
        onBatchNameChange={setBatchName}
        selectedIds={selectedIds}
        documents={documents}
        onRemoveDocument={(id) => setSelectedIds(prev => prev.filter(i => i !== id))}
        onStartProcessing={handleStartProcessing}
        onBack={() => setStep('select')}
        uploading={uploading}
      />
    );
  }

  // Step 3: Processing
  if (step === 'processing' && batch) {
    return <BatchProgress batch={batch} />;
  }

  // Step 4: Complete
  if (step === 'complete' && batch) {
    return <BatchComplete batch={batch} onReset={handleReset} />;
  }

  return null;
}
