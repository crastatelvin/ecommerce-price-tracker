# E-commerce Price Tracker

An elegant, fully-featured e-commerce scraping application built as a local web dashboard and fully compatible as an **Apify Actor**. 

The app tracks target product detail pages and extracts three core attributes:
- **Product Name** (Schema LD, OG Meta tags, or CSS selectors)
- **Extracted Price** (Numeric format and string formatting)
- **Availability** (Detects stock status: In Stock, Out of Stock, or Unknown)

---

## Features

- 📱 **Premium Web Dashboard**: A glassmorphism dark-themed dashboard UI served locally at `http://localhost:3000`.
- ⚙️ **Dual Execution Modes**:
  - **Local Web App**: Runs on your machine, scraping using a local Express server and background browser automation.
  - **Apify Actor**: Directly deployable to the Apify Platform to run on the cloud using Apify's environment.
- 🕒 **Flexible Execution Scheduling**: Set scheduling triggers directly in the UI (Hourly, Daily, Weekly, or Custom Cron) managed locally via `node-cron`.
- 📊 **Multi-Format Dataset Exports**: Download your scraping results instantly as **JSON**, **CSV**, or **Excel (.xlsx)**.
- 🕷️ **Anti-Blocking Playwright Browser Scraper**: Uses Crawlee's `PlaywrightCrawler` with automated headful/headless handling, and intelligent JSON-LD schema parsing that works natively across Shopify, WooCommerce, Amazon, and general e-commerce stores.

---

## Project Structure

```
.
├── .actor/
│   └── input_schema.json     # Apify actor input schema (UI fields for cloud run)
├── src/
│   ├── scraper.js            # Scraper logic utilizing Crawlee's PlaywrightCrawler
│   └── server.js             # Express API Server, cron scheduling, and dataset exporter
├── public/
│   ├── index.html            # Web Dashboard markup
│   ├── style.css             # Glassmorphism theme stylesheet
│   └── app.js                # Frontend data fetcher & state polling script
├── storage/
│   └── config.json           # Persistent configuration file (stores URLs and schedules)
├── apify.json                # Apify actor metadata configurations
├── package.json              # Project dependencies and script endpoints
└── README.md                 # User documentation
```

---

## Local Setup & Quickstart

### Prerequisites
Make sure [Node.js](https://nodejs.org/) (v16 or higher) is installed on your system.

### 1. Install Dependencies
Navigate to the root directory and install npm packages and Playwright browser binaries:
```bash
npm install
npx playwright install
```

### 2. Run the Application
Start the Express server:
```bash
npm start
```

### 3. Open the Dashboard
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## Dashboard Usage

1. **Configure Product URLs**: Enter target e-commerce URLs in the textarea (one URL per line).
2. **Setup Scheduling**:
   - Select the frequency: **Disabled**, **Hourly**, **Daily (9:00 AM)**, **Weekly (Sun 9 AM)**, or **Custom Cron**.
   - If **Custom Cron** is chosen, enter a valid cron expression (e.g. `*/15 * * * *` for every 15 minutes).
   - Click **Save Schedule Config** to persist scheduling settings.
3. **Execute Crawl**: Click **Run Tracker Now** to trigger an immediate scrape in the background. The status badge will change to `RUNNING`.
4. **Data Exports**: Once the scrape updates to `COMPLETED`, click the **JSON**, **CSV**, or **Excel** buttons to download the results file. The grid preview automatically updates with the scraped items.

---

## Direct API Endpoints (Local Execution)

For automation, integration, or terminal queries:

### Get Job Status
```bash
curl http://localhost:3000/api/status
```

### Trigger Scrape
```bash
curl -X POST -H "Content-Type: application/json" -d '{"urls": ["https://example.com"]}' http://localhost:3000/api/scrape
```

### Download Dataset (Format: `json`, `csv`, `xlsx`)
```bash
curl http://localhost:3000/api/export/xlsx --output results.xlsx
```

---

## Running as an Apify Actor

This project includes configuration metadata to easily push and deploy to the [Apify Platform](https://apify.com/).

### 1. Login to Apify CLI
Make sure Apify CLI is installed (`npm install -g apify-cli`) and log in:
```bash
apify login
```

### 2. Run Locally via Apify Command
To verify platform execution context, run:
```bash
apify run
```

### 3. Push and Deploy Actor
Deploy the actor files directly to Apify Console:
```bash
apify push
```
Once deployed, you can trigger execution via the Apify Web Console or invoke it using the Apify API:
```bash
curl -X POST "https://api.apify.com/v2/acts/your-username~ecommerce-price-tracker/runs?token=YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"urls": ["https://example.com"]}'
```
