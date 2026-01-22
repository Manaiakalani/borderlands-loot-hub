import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Key, Shield, Database, Cookie, Eye, Mail } from 'lucide-react';

const Privacy = memo(() => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-vault-gold/20 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="p-2 bg-vault-gold/10 rounded-lg">
                <Key className="w-8 h-8 text-vault-gold" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-vault-gold tracking-tight">
                  SHiFT Vault
                </h1>
                <p className="text-xs text-slate-400">Borderlands Code Hub</p>
              </div>
            </Link>
            <nav className="flex items-center gap-4">
              <Link 
                to="/about" 
                className="text-slate-400 hover:text-vault-gold transition-colors"
              >
                About
              </Link>
              <Link 
                to="/" 
                className="text-slate-400 hover:text-vault-gold transition-colors"
              >
                ← Back to Codes
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-vault-gold/10 rounded-full mb-4">
            <Shield className="w-10 h-10 text-vault-gold" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-slate-400">
            Last updated: January 21, 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Overview */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Overview
            </h2>
            <p className="text-slate-300 leading-relaxed">
              SHiFT Vault ("we", "our", or "the website") is committed to protecting your privacy. 
              This Privacy Policy explains what information we collect, how we use it, and your rights 
              regarding your data. <strong className="text-vault-gold">TL;DR: We don't collect personal data.</strong>
            </p>
          </section>

          {/* Data Collection */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Information We Collect
            </h2>
            <div className="space-y-4 text-slate-300">
              <div>
                <h3 className="font-medium text-white mb-2">We DO NOT Collect:</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Personal identification information (name, email, address)</li>
                  <li>Account credentials or passwords</li>
                  <li>Payment or financial information</li>
                  <li>Location data</li>
                  <li>Device identifiers or fingerprints</li>
                  <li>Browsing history outside this website</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">Local Storage (Your Browser Only):</h3>
                <p className="text-slate-400 mb-2">
                  We use your browser's localStorage to cache SHiFT code data for faster loading. 
                  This data:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Stays on your device only</li>
                  <li>Is never transmitted to any server</li>
                  <li>Can be cleared anytime via your browser settings</li>
                  <li>Automatically refreshes every 7 days</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4 flex items-center gap-2">
              <Cookie className="w-5 h-5" />
              Cookies & Tracking
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We do not use cookies for tracking or advertising. We do not use any third-party 
              analytics services (like Google Analytics). We do not track your behavior across 
              websites. The only client-side storage we use is localStorage for caching code data 
              to improve your experience.
            </p>
          </section>

          {/* Third Party */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4">Third-Party Services</h2>
            <div className="text-slate-300 space-y-3">
              <p>
                <strong className="text-white">GitHub Pages:</strong> This website is hosted on 
                GitHub Pages. GitHub may collect basic server logs (IP addresses, browser info) 
                as part of their service. See{' '}
                <a 
                  href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-vault-gold hover:underline"
                >
                  GitHub's Privacy Statement
                </a>.
              </p>
              <p>
                <strong className="text-white">External Links:</strong> When you click links to 
                external sites (official SHiFT, Twitter, etc.), those sites have their own privacy 
                policies. We are not responsible for their practices.
              </p>
            </div>
          </section>

          {/* Data Sources */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4">SHiFT Code Data Sources</h2>
            <p className="text-slate-300 leading-relaxed mb-3">
              SHiFT codes displayed on this website are aggregated from publicly available sources including:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Official Borderlands social media accounts</li>
              <li>Community websites (MentalMars, Game8, Orcz.com)</li>
              <li>Reddit communities (r/Borderlandsshiftcodes)</li>
              <li>Gaming news publications</li>
            </ul>
            <p className="text-slate-300 mt-3">
              We provide proper attribution and links to original sources where applicable.
            </p>
          </section>

          {/* Your Rights */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4">Your Rights</h2>
            <p className="text-slate-300 leading-relaxed">
              Since we don't collect personal data, there's nothing to delete or export. 
              You can clear your browser's localStorage at any time to remove cached code data. 
              This website is fully functional without any data persistence.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-vault-gold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact
            </h2>
            <p className="text-slate-300 leading-relaxed">
              If you have questions about this Privacy Policy, you can reach out via:
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <a
                href="https://github.com/Manaiakalani/borderlands-loot-hub/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vault-gold hover:underline"
              >
                GitHub Issues
              </a>
              <a
                href="https://twitter.com/manaiakalani"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vault-gold hover:underline"
              >
                @manaiakalani on Twitter
              </a>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="bg-amber-900/20 rounded-xl p-6 border border-amber-700/50">
            <h2 className="text-xl font-semibold text-amber-400 mb-4">⚠️ Disclaimer</h2>
            <p className="text-amber-200/80 leading-relaxed">
              This website is not affiliated with, endorsed by, or connected to Gearbox Software, 
              2K Games, or any of their subsidiaries. Borderlands, SHiFT, and related marks are 
              trademarks of Gearbox Software, LLC. SHiFT codes are provided for informational 
              purposes only with no guarantees of accuracy or validity.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
});

Privacy.displayName = 'Privacy';

export default Privacy;
