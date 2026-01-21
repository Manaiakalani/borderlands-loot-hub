# 🔑 Borderlands SHiFT Vault

<div align="center">

![Borderlands SHiFT Vault](https://img.shields.io/badge/Borderlands-SHiFT%20Vault-gold?style=for-the-badge&logo=playstation&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**A sleek, Borderlands-themed SHiFT code aggregator for Vault Hunters**

[🎮 Live Demo](https://manaiakalani.github.io/borderlands-loot-hub/) • [Report Bug](https://github.com/Manaiakalani/borderlands-loot-hub/issues) • [Request Feature](https://github.com/Manaiakalani/borderlands-loot-hub/issues)

</div>

---

## 📖 Overview

SHiFT Vault is a modern web application that aggregates and displays SHiFT codes for all Borderlands games. Built with React and TypeScript, it features a custom Borderlands-inspired dark theme with vault gold accents, making it easy for Vault Hunters to find and redeem codes for Golden Keys and other rewards.

## ✨ Features

- 🎮 **Multi-Game Support** - Codes for BL1, BL2, Pre-Sequel, BL3, and Tiny Tina's Wonderlands
- 🔍 **Smart Filtering** - Filter by game and code status (active, expired, unknown)
- 📋 **One-Click Copy** - Instantly copy codes to clipboard
- 🆕 **New Today Section** - Highlighted section for freshly added codes
- ⚡ **Weekly Auto-Refresh** - Automatic data refresh with 7-day cache
- 🐦 **Twitter Integration** - Pull codes from @Borderlands, @ShiftCodesTK, and more
- 🎨 **Borderlands Theme** - Custom dark theme with vault gold and orange accents
- ♿ **Accessible** - ARIA labels and keyboard navigation support
- 📱 **Responsive** - Works great on desktop and mobile

## 🎮 Supported Games

| Game | Short Code | Theme Color |
|------|------------|-------------|
| Borderlands (GOTY Enhanced) | BL1 | Blue |
| Borderlands 2 | BL2 | Gold |
| Borderlands: The Pre-Sequel | TPS | Purple |
| Borderlands 3 | BL3 | Orange |
| Tiny Tina's Wonderlands | TTW | Pink |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm, yarn, or [bun](https://bun.sh/)

### Installation

```bash
# Clone the repository
git clone https://github.com/Manaiakalani/borderlands-loot-hub.git
cd borderlands-loot-hub

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

The app will be available at `http://localhost:5173`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run build:dev` | Build for development |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── CodeCard.tsx    # Individual code display card
│   ├── CodeList.tsx    # Grid of code cards
│   ├── FilterBar.tsx   # Game and status filters
│   ├── Header.tsx      # App header with stats
│   ├── Footer.tsx      # App footer with links
│   └── NewTodaySection.tsx  # Highlighted new codes
├── config/
│   └── dataConfig.ts   # Data fetching & caching config
├── data/
│   └── shiftCodes.ts   # Type definitions and code data
├── hooks/
│   └── useShiftCodes.ts # Main data hook with caching
├── lib/
│   └── utils.ts        # Utility functions
├── pages/
│   ├── Index.tsx       # Main page
│   └── NotFound.tsx    # 404 page
├── test/               # Test files
├── App.tsx             # App entry with routing
├── main.tsx            # React DOM entry
└── index.css           # Global styles & theme
.github/
└── workflows/
    └── fetch-twitter-codes.yml  # Daily Twitter fetch
scripts/
└── fetch-twitter-codes.mjs      # Twitter fetch script
```

## 🎨 Tech Stack

- **Framework:** [React 18](https://react.dev/) with TypeScript
- **Build Tool:** [Vite 5](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with custom Borderlands theme
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- **Icons:** [Lucide React](https://lucide.dev/)
- **State Management:** React Query + React hooks
- **Routing:** React Router DOM
- **Testing:** Vitest + Testing Library

## 🔧 Configuration

### Twitter Auto-Fetch (GitHub Actions)

This project uses **GitHub Actions** to automatically fetch SHiFT codes from Twitter daily. No manual setup required after deploying!

**Setup:**
1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `TWITTER_BEARER_TOKEN`
4. Value: Your Twitter API Bearer Token ([get one here](https://developer.twitter.com/))

**Monitored Twitter Accounts:**
- [@Borderlands](https://twitter.com/Borderlands) - Official Gearbox account
- [@ShiftCodesTK](https://twitter.com/ShiftCodesTK) - SHiFT code tracker
- [@borderlands4HQ](https://twitter.com/borderlands4HQ) - BL4 news & codes
- [@DuvalMagic](https://twitter.com/DuvalMagic) - Randy Pitchford (Gearbox CEO)

**How it works:**
- GitHub Actions runs daily at 8 AM UTC
- Fetches tweets from monitored accounts
- Extracts any SHiFT codes found
- Automatically commits new codes to `src/data/shiftCodes.ts`
- You can also trigger it manually from Actions tab

### Data Refresh Settings

Configure in `src/config/dataConfig.ts`:

| Setting | Default | Description |
|---------|---------|-------------|
| `CACHE_DURATION_MS` | 7 days | How long to cache data in browser |
| `STALE_THRESHOLD_MS` | 14 days | When to show "data may be outdated" warning |
| `BACKGROUND_CHECK_INTERVAL_MS` | 24 hours | How often to check for updates while app is open |

### Customizing the Theme

The Borderlands theme is defined in [src/index.css](src/index.css). Key CSS variables:

```css
:root {
  --primary: 45 95% 55%;      /* Vault Gold */
  --accent: 25 95% 55%;       /* Orange */
  --success: 142 70% 45%;     /* Active codes */
  --destructive: 0 72% 51%;   /* Expired codes */
  --warning: 45 95% 55%;      /* Unknown status */
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## ⚠️ Disclaimer

This project is not affiliated with, endorsed by, or connected to Gearbox Software or 2K Games. Borderlands and SHiFT are trademarks of Gearbox Software. All codes are aggregated from publicly available sources.

## 🔗 Useful Links

- [Official SHiFT Website](https://shift.gearboxsoftware.com/rewards) - Redeem your codes here
- [@Borderlands on Twitter](https://twitter.com/Borderlands) - Official announcements
- [r/Borderlands](https://reddit.com/r/Borderlands) - Community discussions

---

<div align="center">

**Happy Vault Hunting! 🎯**

Made with 💛 for the Borderlands community

</div>
