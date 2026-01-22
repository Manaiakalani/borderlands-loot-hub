import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Key, Github, Twitter, ExternalLink, Heart, Code, Users } from 'lucide-react';

const About = memo(() => {
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
            <Link 
              to="/"
              className="text-vault-gold hover:text-vault-gold/80 transition-colors"
            >
              ← Back to Codes
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <div className="inline-flex p-4 bg-vault-gold/10 rounded-full mb-6">
            <Key className="w-16 h-16 text-vault-gold" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            About <span className="text-vault-gold">SHiFT Vault</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Your one-stop destination for all Borderlands SHiFT codes. 
            Never miss a Golden Key again!
          </p>
        </section>

        {/* What is SHiFT Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-vault-gold mb-6 flex items-center gap-2">
            <Key className="w-6 h-6" />
            What is SHiFT?
          </h2>
          <div className="bg-slate-800/50 border border-vault-gold/20 rounded-xl p-6">
            <p className="text-slate-300 mb-4">
              <strong className="text-vault-gold">SHiFT</strong> is Gearbox Software's rewards program 
              for Borderlands games. By entering SHiFT codes, you can unlock:
            </p>
            <ul className="grid md:grid-cols-2 gap-4 text-slate-300">
              <li className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-lg">
                <span className="text-2xl">🔑</span>
                <span><strong className="text-vault-gold">Golden Keys</strong> - Open the chest in Sanctuary for rare loot</span>
              </li>
              <li className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-lg">
                <span className="text-2xl">💎</span>
                <span><strong className="text-vault-gold">Diamond Keys</strong> - Access the Diamond Armory in BL3</span>
              </li>
              <li className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-lg">
                <span className="text-2xl">💀</span>
                <span><strong className="text-vault-gold">Skeleton Keys</strong> - Wonderlands equivalent of Golden Keys</span>
              </li>
              <li className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-lg">
                <span className="text-2xl">🎨</span>
                <span><strong className="text-vault-gold">Cosmetics</strong> - Weapon skins, heads, and more</span>
              </li>
            </ul>
          </div>
        </section>

        {/* How to Redeem Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-vault-gold mb-6 flex items-center gap-2">
            <ExternalLink className="w-6 h-6" />
            How to Redeem Codes
          </h2>
          <div className="bg-slate-800/50 border border-vault-gold/20 rounded-xl p-6">
            <ol className="space-y-4 text-slate-300">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-vault-gold text-slate-900 rounded-full flex items-center justify-center font-bold">1</span>
                <div>
                  <strong className="text-white">Copy the Code</strong>
                  <p className="text-sm text-slate-400">Click the copy button next to any code on this site</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-vault-gold text-slate-900 rounded-full flex items-center justify-center font-bold">2</span>
                <div>
                  <strong className="text-white">Visit the SHiFT Website</strong>
                  <p className="text-sm text-slate-400">
                    Go to{' '}
                    <a 
                      href="https://shift.gearboxsoftware.com/rewards" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-vault-gold hover:underline"
                    >
                      shift.gearboxsoftware.com
                    </a>
                    {' '}and sign in
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-vault-gold text-slate-900 rounded-full flex items-center justify-center font-bold">3</span>
                <div>
                  <strong className="text-white">Paste & Redeem</strong>
                  <p className="text-sm text-slate-400">Paste your code in the "Redeem SHiFT Code" field</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-vault-gold text-slate-900 rounded-full flex items-center justify-center font-bold">4</span>
                <div>
                  <strong className="text-white">Collect In-Game</strong>
                  <p className="text-sm text-slate-400">Check your in-game mail to receive your rewards!</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* About This Project Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-vault-gold mb-6 flex items-center gap-2">
            <Code className="w-6 h-6" />
            About This Project
          </h2>
          <div className="bg-slate-800/50 border border-vault-gold/20 rounded-xl p-6">
            <p className="text-slate-300 mb-4">
              SHiFT Vault is an open-source project built with modern web technologies:
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'shadcn/ui', 'GitHub Actions'].map((tech) => (
                <span 
                  key={tech}
                  className="px-3 py-1 bg-vault-gold/10 text-vault-gold border border-vault-gold/30 rounded-full text-sm"
                >
                  {tech}
                </span>
              ))}
            </div>
            <p className="text-slate-300 mb-4">
              Codes are automatically fetched daily from official Borderlands Twitter accounts 
              using GitHub Actions, ensuring you always have access to the latest codes.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://github.com/Manaiakalani/borderlands-loot-hub"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
              <a
                href="https://twitter.com/Borderlands"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
              >
                <Twitter className="w-5 h-5" />
                @Borderlands
              </a>
            </div>
          </div>
        </section>

        {/* Credits Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-vault-gold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6" />
            Credits & Sources
          </h2>
          <div className="bg-slate-800/50 border border-vault-gold/20 rounded-xl p-6">
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-center gap-3">
                <span className="text-vault-gold">•</span>
                <a href="https://mentalmars.com/game-news/borderlands-3-golden-keys/" target="_blank" rel="noopener noreferrer" className="hover:text-vault-gold transition-colors">
                  MentalMars.com - SHiFT Code Database
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-vault-gold">•</span>
                <a href="https://twitter.com/Borderlands" target="_blank" rel="noopener noreferrer" className="hover:text-vault-gold transition-colors">
                  @Borderlands - Official Gearbox Account
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-vault-gold">•</span>
                <a href="https://twitter.com/DuvalMagic" target="_blank" rel="noopener noreferrer" className="hover:text-vault-gold transition-colors">
                  @DuvalMagic - Randy Pitchford (Gearbox CEO)
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-vault-gold">•</span>
                Gearbox Software - Borderlands franchise
              </li>
            </ul>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="text-center text-slate-500 text-sm">
          <p className="mb-2">
            This is a fan-made project and is not affiliated with Gearbox Software or 2K Games.
          </p>
          <p>
            Borderlands and SHiFT are trademarks of Gearbox Software, LLC.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-vault-gold/20 mt-16 py-8">
        <div className="container mx-auto px-4 text-center space-y-4">
          <p className="text-slate-400 flex items-center justify-center gap-2">
            Made with <Heart className="w-4 h-4 text-vault-gold fill-vault-gold" /> in Seattle, WA for the Borderlands community
          </p>
          <div className="flex items-center justify-center gap-6">
            <a
              href="https://github.com/Manaiakalani"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-vault-gold transition-colors"
              aria-label="Visit creator's GitHub profile"
            >
              <Github className="w-4 h-4" />
              @Manaiakalani
            </a>
            <a
              href="https://twitter.com/manaiakalani"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-vault-gold transition-colors"
              aria-label="Follow creator on Twitter"
            >
              <Twitter className="w-4 h-4" />
              @manaiakalani
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
});

About.displayName = 'About';

export default About;
