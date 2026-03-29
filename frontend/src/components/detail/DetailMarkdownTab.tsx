import { MarkdownViewer } from '../MarkdownViewer';

interface DetailMarkdownTabProps {
  markdown: string | null;
}

export function DetailMarkdownTab({ markdown }: DetailMarkdownTabProps) {
  return (
    <div className="px-6 py-5">
      {markdown ? (
        <MarkdownViewer markdown={markdown} />
      ) : (
        <div className="text-center py-16 text-bw-400 text-sm">
          No extracted text available
        </div>
      )}
    </div>
  );
}
