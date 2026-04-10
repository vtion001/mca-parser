import { useState, useCallback, useRef } from 'react';
import api from '../../services/api';

interface UploadResult {
  job_id: string;
  document_id: number;
  status: string;
}

interface CustomerUploadSectionProps {
  onUploadComplete?: (documentId: number) => void;
  businessId?: string;
}

export function CustomerUploadSection({ onUploadComplete, businessId }: CustomerUploadSectionProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
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
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pdfFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type === 'application/pdf'
      );
      if (pdfFiles.length > 0) {
        setFiles(pdfFiles);
        setUploadResult(null);
      } else {
        setError('Please select PDF files only');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      const pdfFiles = Array.from(e.target.files).filter(
        file => file.type === 'application/pdf'
      );
      if (pdfFiles.length > 0) {
        setFiles(pdfFiles);
        setUploadResult(null);
      } else {
        setError('Please select PDF files only');
      }
    }
    e.target.value = '';
  }, []);

  const handleUpload = async () => {
    if (!files.length) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', files[0]);
    if (businessId) {
      formData.append('business_id', businessId);
    }
    formData.append('document_type', 'bank_statement');

    try {
      const response = await api.post('/customer/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setUploadResult(response.data);
        setFiles([]);
        if (onUploadComplete) {
          onUploadComplete(response.data.document_id);
        }
      } else {
        setError(response.data.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFiles([]);
    setUploadResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer ${
          dragActive
            ? 'border-black bg-gray-50 scale-[1.01]'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onClick={triggerFileSelect}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="mb-6">
          <div className="w-16 h-16 mx-auto border-2 border-gray-300 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
        </div>

        <p className="text-lg font-medium text-gray-900 mb-2">
          {dragActive ? 'Release to upload' : 'Drop PDF or click to select'}
        </p>
        <p className="text-sm text-gray-500">
          PDF files only, up to 50MB each
        </p>

        {files.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="text-sm font-medium text-gray-700">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {files.map((f, i) => (
                <div key={i} className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]" title={f.name}>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Success Message */}
      {uploadResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          <p className="font-medium">Upload successful!</p>
          <p className="text-green-600 mt-1">Document is being processed. You can track its status below.</p>
        </div>
      )}

      {/* Action Buttons */}
      {files.length > 0 && (
        <div className="flex gap-4 justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className="px-6 py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 transition-all duration-150 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleUpload(); }}
            disabled={loading}
            className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-lg transition-all duration-150 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      )}

      {/* Upload Tips */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>Supported: Bank statements, Financial documents</p>
        <p>Processing includes: Text extraction, Balance analysis, MCA detection</p>
      </div>
    </div>
  );
}
