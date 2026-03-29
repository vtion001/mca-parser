export type DetailTabId = 'markdown' | 'key_details' | 'scores' | 'pii' | 'ai';

interface Tab {
  id: DetailTabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'markdown', label: 'Markdown' },
  { id: 'key_details', label: 'Key Details' },
  { id: 'scores', label: 'Scores' },
  { id: 'pii', label: 'PII' },
  { id: 'ai', label: 'AI Analysis' },
];

interface DetailTabNavProps {
  activeTab: DetailTabId;
  onTabChange: (tab: DetailTabId) => void;
}

export function DetailTabNav({ activeTab, onTabChange }: DetailTabNavProps) {
  return (
    <div className="flex-shrink-0 border-b border-bw-100 px-6">
      <div className="flex gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-bw-900'
                : 'text-bw-400 hover:text-bw-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
