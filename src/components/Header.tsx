import { ExternalLink, Key, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  totalCodes: number;
  activeCodes: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function Header({ totalCodes, activeCodes, onRefresh, isRefreshing }: HeaderProps) {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
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

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                asChild
                variant="vault"
                size="sm"
                className="hidden sm:flex"
              >
                <a
                  href="https://shift.gearboxsoftware.com/rewards"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Redeem Codes
                  <ExternalLink className="w-4 h-4 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
