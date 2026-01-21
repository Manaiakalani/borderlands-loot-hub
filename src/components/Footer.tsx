import { ExternalLink, Github, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 mt-auto">
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
              href="https://shift.gearboxsoftware.com/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Official SHiFT
            </a>
            <a
              href="https://twitter.com/Borderlands"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Twitter className="w-4 h-4" />
              @Borderlands
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
