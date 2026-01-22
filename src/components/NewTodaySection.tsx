import { memo } from 'react';
import { ShiftCode } from '@/data/shiftCodes';
import { CodeCard } from './CodeCard';
import { Sparkles, Zap } from 'lucide-react';

interface NewTodaySectionProps {
  codes: ShiftCode[];
}

export const NewTodaySection = memo(function NewTodaySection({ codes }: NewTodaySectionProps) {
  if (codes.length === 0) return null;

  return (
    <section className="vault-open">
      {/* Section Header with glow effect */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 neon-border animate-pulse-border">
          <Sparkles className="w-5 h-5 text-primary vault-glow" />
          <span className="text-base font-bold text-primary uppercase tracking-wider">
            New Today
          </span>
          <Zap className="w-4 h-4 text-primary animate-pulse" />
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/50 to-transparent" />
        <span className="text-sm text-muted-foreground px-2 py-1 bg-card rounded">
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
