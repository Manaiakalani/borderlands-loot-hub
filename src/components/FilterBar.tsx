import { memo } from 'react';
import { GameType, CodeStatus, GAME_INFO } from '@/data/shiftCodes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  selectedGame: GameType | 'ALL';
  selectedStatus: CodeStatus | 'ALL';
  onGameChange: (game: GameType | 'ALL') => void;
  onStatusChange: (status: CodeStatus | 'ALL') => void;
}

/** Available games for filtering */
const GAMES: readonly (GameType | 'ALL')[] = ['ALL', 'BL1', 'BL2', 'TPS', 'BL3', 'WONDERLANDS'] as const;

/** Available statuses for filtering */
const STATUSES: readonly (CodeStatus | 'ALL')[] = ['ALL', 'active', 'expired', 'unknown'] as const;

export const FilterBar = memo(function FilterBar({ selectedGame, selectedStatus, onGameChange, onStatusChange }: FilterBarProps) {
  return (
    <div className="space-y-4 p-4 bg-card/30 rounded-xl border border-border/50 backdrop-blur-sm" role="search" aria-label="Filter codes">
      {/* Game Filter */}
      <fieldset>
        <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Game
        </legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by game">
          {GAMES.map((game) => (
            <Button
              key={game}
              variant={selectedGame === game ? 'vault' : 'secondary'}
              size="sm"
              onClick={() => onGameChange(game)}
              aria-pressed={selectedGame === game}
              className={cn(
                "transition-all duration-200",
                selectedGame !== game && "hover:border-primary/50"
              )}
            >
              {game === 'ALL' ? 'All Games' : GAME_INFO[game].shortName}
            </Button>
          ))}
        </div>
      </fieldset>

      {/* Status Filter */}
      <fieldset>
        <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Status
        </legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUSES.map((status) => (
            <Button
              key={status}
              variant={selectedStatus === status ? 'vault' : 'secondary'}
              size="sm"
              onClick={() => onStatusChange(status)}
              aria-pressed={selectedStatus === status}
              className={cn(
                "transition-all duration-200",
                selectedStatus !== status && "hover:border-primary/50"
              )}
            >
              {status === 'ALL' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </fieldset>
    </div>
  );
});
