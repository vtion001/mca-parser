import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { CustomerUploadSection } from './CustomerUploadSection';
import { CustomerDocumentList } from './CustomerDocumentList';
import { McaStandingCard } from './McaStandingCard';

interface DashboardData {
  total_documents: number;
  status_breakdown: {
    pending: number;
    processing: number;
    complete: number;
    failed: number;
  };
  recent_documents: Array<{
    id: number;
    filename: string;
    status: string;
    document_type: string | null;
    created_at: string;
    balance_summary: { ending: number | null } | null;
    mca_summary: { transactions: number; amount: number } | null;
  }>;
  mca_standing: {
    eligibility_score: number;
    eligibility_level: string;
    recommendation: string;
  };
}

interface CustomerDashboardViewProps {
  businessId?: string;
  onSelectDocument?: (id: number) => void;
}

export function CustomerDashboardView({ businessId, onSelectDocument }: CustomerDashboardViewProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'upload' | 'documents'>('upload');

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/customer/dashboard');
      setDashboard(response.data.data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard, refreshTrigger]);

  const handleUploadComplete = () => {
    setRefreshTrigger(t => t + 1);
    setActiveTab('documents');
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 text-sm">{error}</p>
        <button onClick={fetchDashboard} className="mt-3 text-sm text-red-600 underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Documents"
            value={dashboard.total_documents}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            label="Completed"
            value={dashboard.status_breakdown.complete}
            highlight
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            }
          />
          <StatCard
            label="Processing"
            value={dashboard.status_breakdown.processing}
            icon={
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />
          <StatCard
            label="MCA Score"
            value={dashboard.mca_standing.eligibility_score}
            suffix={`/ 100`}
            level={dashboard.mca_standing.eligibility_level}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'upload'
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload Document
            {activeTab === 'upload' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === 'documents'
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Documents
            {activeTab === 'documents' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {activeTab === 'upload' ? (
            <CustomerUploadSection
              businessId={businessId}
              onUploadComplete={handleUploadComplete}
            />
          ) : (
            <CustomerDocumentList
              onSelectDocument={onSelectDocument}
              refreshTrigger={refreshTrigger}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* MCA Standing Card */}
          <McaStandingCard refreshTrigger={refreshTrigger} />

          {/* Recommendation */}
          {dashboard?.mca_standing.recommendation && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Funding Recommendation</h3>
              <p className="text-sm text-gray-600">{dashboard.mca_standing.recommendation}</p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    dashboard.mca_standing.eligibility_level === 'excellent' ||
                    dashboard.mca_standing.eligibility_level === 'good' ? 'bg-green-500' :
                    dashboard.mca_standing.eligibility_level === 'moderate' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`} />
                  <span className="text-xs text-gray-500 capitalize">
                    {dashboard.mca_standing.eligibility_level} Standing
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {dashboard && dashboard.recent_documents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Documents</h3>
              <div className="space-y-3">
                {dashboard.recent_documents.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                        doc.status === 'complete' ? 'bg-green-100 text-green-700' :
                        doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                        doc.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {doc.balance_summary?.ending && (
                      <span className="text-xs font-medium text-gray-700">
                        {formatCurrency(doc.balance_summary.ending)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  highlight,
  level
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  level?: string;
}) {
  const getLevelColor = (lvl?: string) => {
    if (!lvl) return '';
    if (lvl === 'excellent' || lvl === 'good') return 'text-green-600';
    if (lvl === 'moderate') return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`bg-white rounded-xl border ${highlight ? 'border-gray-300' : 'border-gray-200'} p-4`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            highlight ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {icon}
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-xl font-bold ${getLevelColor(level)}`}>
            {value}{suffix}
          </p>
        </div>
      </div>
    </div>
  );
}
