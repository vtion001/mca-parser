import { KeyDetailsPanel } from '../KeyDetailsPanel';
import type { KeyDetail } from '../../types/extraction';

interface DetailKeyDetailsTabProps {
  details: KeyDetail[];
  documentType: string;
  typeConfidence: number;
}

export function DetailKeyDetailsTab({
  details,
  documentType,
  typeConfidence,
}: DetailKeyDetailsTabProps) {
  return (
    <div className="px-6 py-5">
      <KeyDetailsPanel
        details={details}
        documentType={documentType}
        typeConfidence={typeConfidence}
      />
    </div>
  );
}
