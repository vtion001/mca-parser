interface ReviewEmptyStateProps {
  hasFilter: boolean;
}

export function ReviewEmptyState({ hasFilter }: ReviewEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <svg
        className="w-8 h-8 text-bw-200"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="text-xs text-bw-400">
        {hasFilter
          ? 'No transactions match the current filter.'
          : 'No transactions found in this statement.'}
      </p>
    </div>
  );
}
