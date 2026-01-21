import { GameType, CodeStatus, GAME_INFO } from '@/data/shiftCodes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  selectedGame: GameType | 'ALL';
  selectedStatus: CodeStatus | 'ALL';
  onGameChange: (game: GameType | 'ALL') => void;
  onStatusChange: (status: CodeStatus | 'ALL') => void;
}

const games: (GameType | 'ALL')[] = ['ALL', 'BL1', 'BL2', 'TPS', 'BL3', 'WONDERLANDS'];
const statuses: (CodeStatus | 'ALL')[] = ['ALL', 'active', 'expired', 'unknown'];

export function FilterBar({ selectedGame, selectedStatus, onGameChange, onStatusChange }: FilterBarProps) {
  return (
    <div className="space-y-4 p-4 bg-card/30 rounded-xl border border-border/50 backdrop-blur-sm">
      {/* Game Filter */}
      <div>
        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Game
        </label>
        <div className="flex flex-wrap gap-2">
          {games.map((game) => (
            <Button
              key={game}
              variant={selectedGame === game ? 'vault' : 'secondary'}
              size="sm"
              onClick={() => onGameChange(game)}
              className={cn(
                "transition-all duration-200",
                selectedGame !== game && "hover:border-primary/50"
              )}
            >
              {game === 'ALL' ? 'All Games' : GAME_INFO[game].shortName}
            </Button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <Button
              key={status}
              variant={selectedStatus === status ? 'vault' : 'secondary'}
              size="sm"
              onClick={() => onStatusChange(status)}
              className={cn(
                "transition-all duration-200",
                selectedStatus !== status && "hover:border-primary/50"
              )}
            >
              {status === 'ALL' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
