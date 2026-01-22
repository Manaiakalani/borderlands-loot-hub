import { useState, memo, useCallback } from 'react';
import { Copy, Check, Clock, AlertCircle, ExternalLink, Key, Sparkles, Calendar, CheckCircle } from 'lucide-react';
import { ShiftCode, GAME_INFO, CodeStatus, RewardType } from '@/data/shiftCodes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Status configuration for styling and icons */
const STATUS_CONFIG: Record<CodeStatus, {
  label: string;
  className: string;
  icon: typeof Check;
}> = {
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

/** Reward type labels */
const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  'golden-keys': 'Golden Keys',
  'skeleton-keys': 'Skeleton Keys',
  'diamond-keys': 'Diamond Keys',
  'skin': 'Skin',
  'cosmetic': 'Cosmetic',
  'weapon': 'Weapon',
  'other': 'Other',
};

/** Redeem URL for SHiFT codes */
const SHIFT_REDEEM_URL = 'https://shift.gearboxsoftware.com/rewards';

/**
 * Formats a date string for display
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Gets a relative time description (e.g., "2 days ago", "in 3 days")
 */
const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
};

/**
 * Checks if expiration is soon (within 7 days)
 */
const isExpiringSoon = (expiresAt: string | null | undefined): boolean => {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= 7;
};

interface CodeCardProps {
  code: ShiftCode;
  isNew?: boolean;
  isRecent?: boolean;
}

export const CodeCard = memo(function CodeCard({ code, isNew, isRecent }: CodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = useCallback(async () => {
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
  }, [code.code]);

  const gameInfo = GAME_INFO[code.game];
  const status = STATUS_CONFIG[code.status];
  const StatusIcon = status.icon;
  const isExpired = code.status === 'expired';

  // Game-specific CSS class for color accents
  const gameColorClass = `game-${code.game.toLowerCase()}`;

  return (
    <div
      className={cn(
        "group relative p-4 rounded-xl border bg-card transition-all duration-300",
        "hover:translate-y-[-2px] hover:shadow-lg hover:shadow-black/20",
        "card-borderlands game-accent game-glow",
        gameColorClass,
        code.status === 'active' && "border-success/20 hover:border-success/40",
        code.status === 'expired' && "border-destructive/20 opacity-60 hover:opacity-80",
        code.status === 'unknown' && "border-warning/20 hover:border-warning/40",
        isNew && "ring-2 ring-primary/30 animate-pulse-border neon-border"
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
            {REWARD_TYPE_LABELS[code.rewardType]}
          </span>
        </div>

        {/* Status Badge */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border transition-all duration-200",
          status.className,
          isHovered && "scale-105"
        )}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </div>
      </div>

      {/* Code - with glitch effect on hover */}
      <div className="mb-3 relative overflow-hidden">
        <code className={cn(
          "font-mono-code text-lg sm:text-xl font-bold tracking-wide break-all transition-all duration-200",
          "glitch-text select-all cursor-pointer",
          isHovered && code.status !== 'expired' ? "text-primary" : "text-foreground"
        )}>
          {code.code}
        </code>
        {/* Animated underline on hover */}
        <div className={cn(
          "absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-out",
          isHovered ? "w-full" : "w-0"
        )} />
      </div>

      {/* Reward */}
      <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
        <Key className="w-4 h-4 text-primary/60" />
        {code.reward}
      </p>

      {/* Bottom Row: Source & Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Source: {code.source}
          </span>
          
          {/* Last Verified Date */}
          {code.lastVerifiedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-success" />
              Verified: {formatDate(code.lastVerifiedAt)} ({getRelativeTime(code.lastVerifiedAt)})
            </span>
          )}
          
          {/* Expiration Date */}
          {code.expiresAt && (
            <span className={cn(
              "text-xs flex items-center gap-1",
              code.status === 'expired' 
                ? 'text-destructive' 
                : isExpiringSoon(code.expiresAt)
                  ? 'text-warning'
                  : 'text-muted-foreground'
            )}>
              <Calendar className="w-3 h-3" />
              {code.status === 'expired' ? (
                <>Expired: {formatDate(code.expiresAt)}</>
              ) : isExpiringSoon(code.expiresAt) ? (
                <>⚠️ Expires {getRelativeTime(code.expiresAt)}!</>
              ) : (
                <>Expires: {formatDate(code.expiresAt)} ({getRelativeTime(code.expiresAt)})</>
              )}
            </span>
          )}
          
          {/* Never expires indicator for active codes without expiry */}
          {!code.expiresAt && code.status === 'active' && (
            <span className="text-xs text-success/70 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              No expiration (permanent)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={copied ? 'success' : 'secondary'}
            size="sm"
            onClick={handleCopy}
            disabled={isExpired}
            aria-label={copied ? 'Code copied' : `Copy code ${code.code}`}
            className={cn(
              "transition-all duration-200",
              copied && "glow-success"
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
          
          {!isExpired && (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-primary"
            >
              <a
                href={SHIFT_REDEEM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Redeem code for ${code.reward}`}
              >
                Redeem
                <ExternalLink className="w-4 h-4 ml-1" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
