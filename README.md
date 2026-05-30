<div align="center">

# 👁️ E-COMMERCE PRICE TRACKER

### Product Scraper Engine — Multimodal Price Intelligence With Glassmorphism UI

[![Node](https://img.shields.io/badge/Node-18.x%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.45%2B-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Express](https://img.shields.io/badge/Express-4.19%2B-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Crawlee](https://img.shields.io/badge/Crawlee-3.11%2B-FF9000?style=for-the-badge)](https://crawlee.dev/)
[![Apify](https://img.shields.io/badge/Apify-Actor-FF1F5A?style=for-the-badge)](https://apify.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

> **E-commerce Price Tracker** is a production-ready price tracking and scraping platform. Input store URLs, execute automated scheduled scrapes, and extract structured product name, price, and stock availability — all rendered in a premium glassmorphic dark dashboard with dynamic grid card views and direct Excel/CSV downloads.

<br/>

![Extraction](https://img.shields.io/badge/Extraction-JSON--LD_%2B_Meta_Parsers-f3b44f?style=for-the-badge) ![Realtime](https://img.shields.io/badge/Realtime-Express_Metrics_API-5aa6ff?style=for-the-badge) ![Automation](https://img.shields.io/badge/Automation-Node--Cron_Schedules-b189ff?style=for-the-badge) ![Exports](https://img.shields.io/badge/Exports-JSON_/_CSV_/_Excel-22c55e?style=for-the-badge)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Application Preview](#-application-preview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Design Decisions](#-design-decisions)
- [License](#-license)

---

## 🧠 Overview

**E-commerce Price Tracker** provides a local and cloud-compatible workflow for product price intelligence. The backend launches headless Playwright instances via Crawlee, scrolls to execute dynamic content loading, parses multiple structured data layouts (JSON-LD schemas, OpenGraph, or CSS Selectors), and serves the real-time dataset to a dark glassmorphic client-side dashboard.

Users can:
- Paste single/multiple product and listing URLs to crawl stores.
- Toggle advanced scraping features (Apify rotating proxies, infinite scrolls, and category product enqueuing).
- Monitor progress live and view real-time metrics (Total found, in-stock count, average market price).
- Switch between interactive layout view presentation modes (Table List vs. Card Grid).
- Download dataset exports on-demand in `.json`, `.csv`, or formatted Excel `.xlsx` spreadsheets.

---

## 🖼️ Application Preview

<div align="center">

### 1) Volcanic Dark Dashboard View

![Dashboard View](scratch/dashboard_screenshot.png)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🛍️ **Multi-Source Scraping** | Crawls e-commerce websites utilizing headless browser execution via Playwright |
| 🔄 **Crawling & Enqueuing** | Discovers and crawls product pages inside collection listings automatically |
| ⏱️ **Infinite Scroll Support** | Simulates scrolls to capture lazy-loaded dynamic image assets and layout content |
| 🛡️ **Proxy Rotation** | Integrated proxy rotation support to prevent IP blocking and rate limits |
| 📊 **Dynamic Metrics** | Live panel computing average catalog prices, in-stock counts, and total products |
| 🎛️ **Dual View Layout** | Toggle layout view presentation between a tabular data list and interactive cards |
| 📅 **Cron Automations** | Node-cron scheduling frequencies (Hourly, Daily, Weekly, or Custom Cron patterns) |
| 📥 **Multi-Format Exports** | Real-time backend sheet exporter producing clean CSV, JSON, and Microsoft Excel sheets |
| 🚀 **Dual Run Target** | Runs locally as a standalone Web Service or on the Apify Cloud Platform as a Batch Actor |

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      Glassmorphism Dashboard                      │
│                                                                   │
│  UrlInputs ──► SegmentedTabs ──► ViewToggles (Table / Cards Grid) │
│      │              │                    │                        │
│      └────── POST /api/scrape ◄──────────┘                        │
│             GET /api/status                                       │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                          Express Backend                          │
│                                                                   │
│  Middleware: CORS + Static Assets Router + JSON Parser            │
│                                                                   │
│  /api/scrape ─► scraper.js ───────► PlaywrightCrawler (Crawlee)    │
│                                  ├► JSON-LD Schema Extractor      │
│                                  ├► Meta OG/Twitter Fallbacks     │
│                                  └► CSS Selector Fallbacks        │
│                                                                   │
│  /api/config ─► storage/config.json (Persistent configuration)   │
│  /api/export ─► xlsx-exporter / csv-generator / json-stream       │
│                                                                   │
│  node-cron triggers scheduled background crawls on active URLs    │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express, Crawlee, Playwright |
| **Provider** | Apify SDK & CLI compatibility layers |
| **Parser Engine** | JSON-LD schema search, OpenGraph, custom CSS fallback matchers |
| **Scheduler** | Node-cron |
| **Persistence** | File-based local store (`storage/config.json`, `storage/datasets/`) |
| **Frontend** | Vanilla HTML5/CSS3 (Inter Font, Volcanic HSL Glassmorphism, animations) |
| **Sheet Engine** | `xlsx` node package, CSV string stream generators |

---

## 📁 Project Structure

```
ecommerce-price-tracker/
│
├── .actor/
│   └── input_schema.json          # Apify Actor Console Inputs configuration
│
├── public/
│   ├── index.html                 # Main dashboard structural layouts
│   ├── style.css                  # Volcanic theme visual styles & animations
│   └── app.js                     # Dashboard state, metrics, and search logic
│
├── src/
│   ├── scraper.js                 # Crawlee/Playwright engine with scroll & parsing
│   └── server.js                  # Express API Router, exports, and cron scheduler
│
├── storage/                       # Local database stores (gitignored)
│   ├── config.json                # Local persistent configurations
│   └── datasets/                  # Scraped items dataset runs
│
├── apify.json                     # Apify Platform integration configuration
├── package.json                   # NPM script pathways and dependency versions
├── .gitignore                     # Git track rules
└── README.md                      # Service setup and schema guide
```

---

## 🚀 Installation

### 1) Clone

```bash
git clone https://github.com/crastatelvin/ecommerce-price-tracker.git
cd ecommerce-price-tracker
```

### 2) Setup and Startup

Install project dependencies and boot the local Express server:

```bash
npm install
npm start
```

Dashboard Access: `http://localhost:3000`

---

## 💻 Usage

1. Open the local dashboard page in your web browser.
2. Enter target store homepage or product URLs into the configuration box.
3. Configure your automated tracking schedule using the **Segmented Tab Bar**.
4. Click **Run Tracker Now** to trigger the scraper.
5. Filter, search, and analyze catalog details in the results grid.
6. Export datasets using the download panels.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Load persistent scraper configuration |
| `POST` | `/api/config` | Save scheduling and advanced options configurations |
| `POST` | `/api/scrape` | Trigger manual scraping run immediately |
| `GET` | `/api/status` | Fetch running job state and scraped dataset results |
| `GET` | `/api/export/json` | Export results dataset as JSON |
| `GET` | `/api/export/csv` | Export results dataset as CSV |
| `GET` | `/api/export/xlsx` | Export results dataset as Microsoft Excel Spreadsheet |

---

## ⚙️ Configuration

Scraper inputs are stored locally in `storage/config.json`. When deployed to Apify, configurations map directly to the Actor Console Input schema:

```json
{
  "urls": ["https://zivanche.com"],
  "schedule": "daily",
  "customCron": "0 9 * * *",
  "useProxy": false,
  "crawlLinks": true,
  "maxScrolls": 1
}
```

---

## 🧭 Design Decisions

- **Playwright Crawler & Headless Mode**: Crawlee with Playwright ensures full execution of JS components to scrape dynamic client-rendered products.
- **Three-Tier Product Data Parser**: Structured JSON-LD schema parsing is used first. If absent, fallback extraction matches Meta OG tags or CSS selectors to maximize data capture.
- **Deduplicated Category Traversal**: Category crawling enqueues sub-links into Crawlee's Request Queue, which handles de-duplication automatically to prevent scrapers from visiting identical pages.
- **Local SQLite-free File Persistence**: Using JSON files inside `/storage` provides a lightweight data layer without the overhead of setting up a SQL database.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) if present.

<div align="center">
                          Built by Telvin Crasta · Production-ready · Live today

                   ⭐ If this helped you track e-commerce prices faster, star the repo.
</div>
