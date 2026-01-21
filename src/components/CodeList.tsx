import { memo } from 'react';
import { ShiftCode } from '@/data/shiftCodes';
import { CodeCard } from './CodeCard';
import { PackageOpen } from 'lucide-react';

interface CodeListProps {
  codes: ShiftCode[];
  isRecentFn?: (code: ShiftCode) => boolean;
}

export const CodeList = memo(function CodeList({ codes, isRecentFn }: CodeListProps) {
  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <PackageOpen className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No codes found</h3>
        <p className="text-muted-foreground max-w-md">
          Try adjusting your filters to find more SHiFT codes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="SHiFT codes">
      {codes.map((code, index) => (
        <div
          key={code.id}
          className="animate-fade-in"
          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
          role="listitem"
        >
          <CodeCard 
            code={code} 
            isRecent={isRecentFn ? isRecentFn(code) : false}
          />
        </div>
      ))}
    </div>
  );
});
