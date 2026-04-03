import { useState, useEffect } from 'react';
import api from '../services/api';
import { DocumentFilters } from './library/DocumentFilters';
import { DocumentList } from './library/DocumentList';

export interface Document {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  type_confidence: number | null;
  balances: {
    beginning_balance: { amount: number | null };
    ending_balance: { amount: number | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
  } | null;
  created_at: string;
}

interface DocumentLibraryProps {
  onSelectDocument?: (id: number) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  selectionMode?: boolean;
}

export function DocumentLibrary({
  onSelectDocument,
  selectedIds = [],
  onToggleSelect,
  selectionMode = false
}: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchDocuments();
  }, [filter, search]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (search) params.append('search', search);

      const response = await api.get(`/documents?${params.toString()}`);
      setDocuments(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DocumentFilters
        filter={filter}
        search={search}
        viewMode={viewMode}
        documentCount={documents.length}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
        onViewModeChange={setViewMode}
      />

      <DocumentList
        documents={documents}
        viewMode={viewMode}
        selectedIds={selectedIds}
        selectionMode={selectionMode}
        onSelectDocument={onSelectDocument}
        onToggleSelect={onToggleSelect}
        onDelete={handleDelete}
      />

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 pt-4 border-t">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span>Complete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Processing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-gray-300" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
