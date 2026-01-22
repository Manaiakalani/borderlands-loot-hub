import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Twitter, Github, Heart, Shield } from 'lucide-react';

/** External links */
const SHIFT_OFFICIAL_URL = 'https://shift.gearboxsoftware.com/rewards';
const BORDERLANDS_TWITTER_URL = 'https://twitter.com/Borderlands';
const CREATOR_GITHUB_URL = 'https://github.com/Manaiakalani';
const CREATOR_TWITTER_URL = 'https://twitter.com/manaiakalani';

export const Footer = memo(function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 mt-auto" role="contentinfo">
      <div className="container py-6">
        <div className="flex flex-col items-center gap-6">
          {/* Made with love */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground group cursor-default">
            <span>Made with</span>
            <Heart className="w-4 h-4 text-vault-gold fill-vault-gold transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(245,184,0,0.8)] group-hover:scale-110" aria-label="love" />
            <span>in Seattle, WA for the Borderlands community</span>
          </div>
          
          {/* Creator links */}
          <div className="flex items-center gap-4">
            <a
              href={CREATOR_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-vault-gold transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(245,184,0,0.6)]"
              aria-label="Visit creator's GitHub profile"
            >
              <Github className="w-4 h-4" aria-hidden="true" />
              @Manaiakalani
            </a>
            <a
              href={CREATOR_TWITTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-vault-gold transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(245,184,0,0.6)]"
              aria-label="Follow creator on Twitter"
            >
              <Twitter className="w-4 h-4" aria-hidden="true" />
              @manaiakalani
            </a>
          </div>

          {/* Divider */}
          <div className="w-24 h-px bg-vault-gold/30" />

          {/* Official links and disclaimer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                Codes aggregated from public sources. Not affiliated with Gearbox Software.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Always verify codes at the official redemption site before use.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link
                to="/privacy"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Shield className="w-4 h-4" aria-hidden="true" />
                Privacy
              </Link>
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
      </div>
    </footer>
  );
});
