import { useState } from 'react';
import { Copy, Check, Clock, AlertCircle, ExternalLink, Key, Sparkles } from 'lucide-react';
import { ShiftCode, GAME_INFO } from '@/data/shiftCodes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CodeCardProps {
  code: ShiftCode;
  isNew?: boolean;
  isRecent?: boolean;
}

export function CodeCard({ code, isNew, isRecent }: CodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      toast.success('Code copied to clipboard!', {
        description: 'Ready to redeem at shift.gearboxsoftware.com',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const gameInfo = GAME_INFO[code.game];
  
  const statusConfig = {
    active: {
      label: 'Active',
      className: 'bg-success/10 text-success border-success/30',
      icon: Check,
    },
    expired: {
      label: 'Expired',
      className: 'bg-destructive/10 text-destructive border-destructive/30',
      icon: Clock,
    },
    unknown: {
      label: 'Unknown',
      className: 'bg-warning/10 text-warning border-warning/30',
      icon: AlertCircle,
    },
  };

  const rewardTypeConfig = {
    'golden-keys': { label: 'Keys', icon: Key },
    'skin': { label: 'Skin', icon: null },
    'cosmetic': { label: 'Cosmetic', icon: null },
    'weapon': { label: 'Weapon', icon: null },
    'other': { label: 'Other', icon: null },
  };

  const status = statusConfig[code.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        "group relative p-4 rounded-xl border bg-card transition-all duration-300",
        "hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20",
        code.status === 'active' && "border-success/20 hover:border-success/40",
        code.status === 'expired' && "border-destructive/20 opacity-60 hover:opacity-80",
        code.status === 'unknown' && "border-warning/20 hover:border-warning/40",
        isNew && "ring-2 ring-primary/30 animate-pulse-border"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* New Badge */}
      {isNew && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg">
          <Sparkles className="w-3 h-3" />
          NEW
        </div>
      )}
      
      {/* Recent Badge */}
      {isRecent && !isNew && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-bold shadow-lg">
          RECENT
        </div>
      )}

      {/* Top Row: Game & Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Game Badge */}
          <span
            className="px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wider"
            style={{
              backgroundColor: `${gameInfo.color}20`,
              color: gameInfo.color,
              border: `1px solid ${gameInfo.color}40`,
            }}
          >
            {gameInfo.shortName}
          </span>
          
          {/* Reward Type */}
          <span className="text-xs text-muted-foreground">
            {rewardTypeConfig[code.rewardType].label}
          </span>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border",
          status.className
        )}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </div>
      </div>

      {/* Code */}
      <div className="mb-3 relative">
        <code className={cn(
          "font-mono-code text-lg sm:text-xl font-bold tracking-wide break-all transition-colors duration-200",
          isHovered && code.status !== 'expired' ? "text-primary" : "text-foreground"
        )}>
          {code.code}
        </code>
      </div>

      {/* Reward */}
      <p className="text-sm text-muted-foreground mb-4">
        {code.reward}
      </p>

      {/* Bottom Row: Source & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">
            Source: {code.source}
          </span>
          {code.expiresAt && (
            <span className={cn(
              "text-xs",
              code.status === 'expired' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {code.status === 'expired' ? 'Expired: ' : 'Expires: '}
              {new Date(code.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={copied ? 'success' : 'secondary'}
            size="sm"
            onClick={handleCopy}
            disabled={code.status === 'expired'}
            className={cn(
              "transition-all duration-200",
              copied && "glow-success"
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </>
            )}
          </Button>
          
          {code.status !== 'expired' && (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-primary"
            >
              <a
                href={`https://shift.gearboxsoftware.com/rewards`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Redeem
                <ExternalLink className="w-4 h-4 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
