import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Key, RefreshCw, AlertTriangle, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/** Official SHiFT redemption URL */
const SHIFT_REDEEM_URL = 'https://shift.gearboxsoftware.com/rewards';

/** Data source display names */
const SOURCE_LABELS: Record<string, string> = {
  local: 'Embedded Data',
  remote: 'Remote API',
};

interface HeaderProps {
  totalCodes: number;
  activeCodes: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastFetched?: Date | null;
  isStale?: boolean;
  nextRefreshIn?: string | null;
  dataSource?: 'local' | 'remote';
}

export const Header = memo(function Header({ 
  totalCodes, 
  activeCodes, 
  onRefresh, 
  isRefreshing,
  lastFetched,
  isStale,
  nextRefreshIn,
  dataSource,
}: HeaderProps) {
  const formatLastFetched = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50" role="banner">
      <div className="container py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 glow-vault">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                <span className="text-gradient-vault">SHiFT</span>
                <span className="text-foreground"> Vault</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Borderlands SHiFT Code Aggregator
              </p>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Stats Pills */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-success/10 border border-success/30 text-success text-sm font-semibold">
                {activeCodes} Active
              </div>
              <div className="px-3 py-1.5 rounded-full bg-secondary border border-border text-muted-foreground text-sm font-semibold">
                {totalCodes} Total
              </div>
            </div>

            {/* Stale Warning */}
            {isStale && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="px-2 py-1 rounded-full bg-warning/10 border border-warning/30 text-warning">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Data may be outdated. Click refresh to update.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRefresh}
                      disabled={isRefreshing}
                      aria-label="Refresh codes"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      {lastFetched && (
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated: {formatLastFetched(lastFetched)}
                        </p>
                      )}
                      {nextRefreshIn && (
                        <p className="text-muted-foreground">
                          Auto-refresh in: {nextRefreshIn}
                        </p>
                      )}
                      {dataSource && (
                        <p className="text-muted-foreground">
                          Source: {SOURCE_LABELS[dataSource] || dataSource}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Link to="/about" aria-label="About SHiFT Vault">
                        <Info className="w-5 h-5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>About & How to Redeem</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                asChild
                variant="vault"
                size="sm"
                className="hidden sm:flex"
              >
                <a
                  href={SHIFT_REDEEM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open SHiFT redemption website"
                >
                  Redeem Codes
                  <ExternalLink className="w-4 h-4 ml-1.5" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});
