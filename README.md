# MisHoritas

A mobile-first app for professionals to track work hours, manage billing, and visualize income — built with Ionic, Angular, and Capacitor.

## Overview

MisHoritas helps freelancers and independent professionals who work across multiple establishments keep accurate records of their hours and earnings. Log hours daily, set rates per hour type, confirm monthly billing, and get detailed financial reports — all from your phone.

## Features

**Hour tracking**
- Interactive calendar with monthly, weekly, and daily views
- Log hours by establishment and hour type
- Support for decimal hours (e.g. 8.5h)

**Billing**
- Set hourly rates per establishment and hour type
- Add fixed-amount additional items (bonuses, travel, etc.)
- Monthly billing confirmation workflow
- PDF export for sharing or archiving

**Reports**
- Total revenue, hours, and average rate KPIs
- Revenue breakdown by establishment, hour type, and source
- Monthly evolution and rate evolution charts
- Period comparison (month, quarter, semester, year)

**Customization**
- 4 color themes: Nocturne, Ocean, Sunset, Sapphire
- Light and dark mode with system preference detection
- Spanish and English language support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Angular 20 |
| UI | Ionic 8 |
| Native | Capacitor 8 (iOS) |
| Charts | Chart.js |
| PDF | jsPDF |
| Storage | @ionic/storage-angular (IndexedDB / localStorage) |
| i18n | Custom service with JSON translation files |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install and run

```bash
npm install
npm start
```

The app runs at `http://localhost:8100`.

### Build for production

```bash
npm run build
```

Output goes to `www/`.

### iOS (requires macOS)

```bash
npx cap add ios
npx cap sync
npx cap open ios
```

## Project Structure

```
src/
├── app/
│   ├── components/       # Reusable UI components (day-modal, wizard, etc.)
│   ├── models/           # Data models and constants
│   ├── pages/            # App screens
│   │   ├── calendar/     # Main view — hour tracking
│   │   ├── billing/      # Monthly billing management
│   │   ├── reports/      # Financial reports and charts
│   │   ├── onboarding/   # First-time setup wizard
│   │   └── splash/       # Launch screen
│   └── services/         # Business logic and data persistence
├── assets/
│   ├── i18n/             # Translation files (en.json, es.json)
│   └── icon/             # App icons
└── theme/
    └── variables.scss    # Theme tokens and palette definitions
```

## License

Private — all rights reserved.
