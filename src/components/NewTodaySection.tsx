import { memo } from 'react';
import { ShiftCode } from '@/data/shiftCodes';
import { CodeCard } from './CodeCard';
import { Sparkles } from 'lucide-react';

interface NewTodaySectionProps {
  codes: ShiftCode[];
}

export const NewTodaySection = memo(function NewTodaySection({ codes }: NewTodaySectionProps) {
  if (codes.length === 0) return null;

  return (
    <section className="animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 animate-pulse-border">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary uppercase tracking-wider">
            New Today
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {codes.length} fresh {codes.length === 1 ? 'code' : 'codes'}
        </span>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="New codes added today">
        {codes.map((code, index) => (
          <div
            key={code.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
            role="listitem"
          >
            <CodeCard code={code} isNew />
          </div>
        ))}
      </div>
    </section>
  );
});
