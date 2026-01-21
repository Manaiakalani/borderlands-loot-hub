import { memo } from 'react';
import { ExternalLink, Twitter } from 'lucide-react';

/** External links */
const SHIFT_OFFICIAL_URL = 'https://shift.gearboxsoftware.com/rewards';
const BORDERLANDS_TWITTER_URL = 'https://twitter.com/Borderlands';

export const Footer = memo(function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 mt-auto" role="contentinfo">
      <div className="container py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              Codes aggregated from public sources. Not affiliated with Gearbox Software.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Always verify codes at the official redemption site before use.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <a
              href={SHIFT_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              aria-label="Visit official SHiFT website"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Official SHiFT
            </a>
            <a
              href={BORDERLANDS_TWITTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              aria-label="Follow Borderlands on Twitter"
            >
              <Twitter className="w-4 h-4" aria-hidden="true" />
              @Borderlands
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
});
