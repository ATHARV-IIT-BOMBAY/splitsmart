# SplitSmart

Scan a hostel receipt, fix what the scanner got wrong, assign items to the people who had them, and settle up with the fewest possible payments. Everything runs in the browser, and receipts never leave your device.

Built by **Team Web Architects** for Web Brawl GC 2026.

**Live app:** https://atharv-iit-bombay.github.io/splitsmart/

## Why SplitSmart?

What problem it solves: Splitting hostel bills by hand sucks. This app gets rid of the messy mental math, forgotten debts, and having to send those awkward WhatsApp reminders to your friends.

Who it's for: Perfect for hostel rooms, wings, group trips, and late-night canteen runs.

What makes it different: Instead of typing everything out, you just scan the receipt and tap who ate what. It automatically figures out how to settle up with the fewest payments possible, and keeps everything right on your phone.

## Setup

Requires Node.js 22+.

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm test` | Run unit tests |
| `npm run lint` | Lint the code |

## Team

| Member | Role | Owns |
|---|---|---|
| **Atharv Pratap Singh Chauhan** | Team lead · Full-stack | App logic (splits, balances, settle-up), data storage, OCR and AI integration, core screens |
| **Nimitt Pamecha** | Frontend developer | UI components, styling, accessibility |
| **Abhiraj Kumar** | QA and test data lead | Real receipt dataset, device testing against all 9 test cases |
| **Abhinav Kaushal** | Documentation and content lead | README, user guide, in-app text, demo script |

SplitSmart has no server by design. All logic, storage and AI run on the user's device for privacy.
