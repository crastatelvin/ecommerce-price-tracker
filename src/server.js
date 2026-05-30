import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import XLSX from 'xlsx';
import { Actor } from 'apify';
import { runScraper } from './scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure local storage folders exist
const STORAGE_DIR = path.join(__dirname, '../storage');
const CONFIG_FILE = path.join(STORAGE_DIR, 'config.json');
const HISTORY_DIR = path.join(STORAGE_DIR, 'history');

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// History saving helper
const saveToHistory = async (results, urls) => {
    try {
        const id = `run_${Date.now()}`;
        const detailFile = path.join(HISTORY_DIR, `${id}.json`);
        fs.writeFileSync(detailFile, JSON.stringify(results, null, 2), 'utf-8');

        const indexFile = path.join(HISTORY_DIR, 'index.json');
        let index = [];
        if (fs.existsSync(indexFile)) {
            try {
                index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
            } catch (err) {
                console.error('[History] Error reading index:', err);
            }
        }

        index.unshift({
            id,
            timestamp: new Date().toISOString(),
            urls,
            itemCount: results.length
        });

        // Limit to 20 entries to prevent disk bloat
        if (index.length > 20) {
            const removed = index.slice(20);
            index = index.slice(0, 20);
            for (const item of removed) {
                const fileToDelete = path.join(HISTORY_DIR, `${item.id}.json`);
                if (fs.existsSync(fileToDelete)) {
                    fs.unlinkSync(fileToDelete);
                }
            }
        }

        fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf-8');
        console.log(`[History] Saved run ${id} with ${results.length} items.`);
    } catch (err) {
        console.error('[History] Error saving history run:', err);
    }
};

// Default config including advanced options
let config = {
    urls: [],
    schedule: 'none',
    customCron: '',
    useProxy: false,
    crawlLinks: false,
    maxScrolls: 0
};

// Load existing config if it exists
if (fs.existsSync(CONFIG_FILE)) {
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
        console.error('[Server] Error reading config file, using defaults:', e);
    }
}

// Helper to save config
const saveConfig = () => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Global state for current running/last run scraping job
let currentJob = {
    status: 'idle', // idle, running, completed, error
    results: [],
    error: null,
    startedAt: null,
    completedAt: null
};

// Cron Scheduler reference
let activeCronTask = null;

// Helper to map UI schedule options to standard cron strings
const getCronString = (type, customCron) => {
    switch (type) {
        case 'hourly':
            return '0 * * * *'; // Top of every hour
        case 'daily':
            return '0 9 * * *';  // 9:00 AM every day
        case 'weekly':
            return '0 9 * * 0';  // 9:00 AM every Sunday
        case 'custom':
            return customCron;
        default:
            return null;
    }
};

// Initialize / Restore Scheduler
const initScheduler = () => {
    if (activeCronTask) {
        activeCronTask.stop();
        activeCronTask = null;
    }

    const cronExpr = getCronString(config.schedule, config.customCron);
    if (cronExpr && config.urls.length > 0) {
        if (!cron.validate(cronExpr)) {
            console.error(`[Scheduler] Invalid cron expression: "${cronExpr}"`);
            return;
        }
        
        console.log(`[Scheduler] Starting cron job with schedule "${config.schedule}" (${cronExpr}) for ${config.urls.length} URLs.`);
        
        activeCronTask = cron.schedule(cronExpr, async () => {
            console.log(`[Scheduler] Running scheduled scrape job at ${new Date().toISOString()}`);
            try {
                currentJob = {
                    status: 'running',
                    results: [],
                    error: null,
                    startedAt: new Date().toISOString(),
                    completedAt: null
                };
                
                const results = await runScraper(config.urls, {
                    useProxy: config.useProxy,
                    crawlLinks: config.crawlLinks,
                    maxScrolls: config.maxScrolls
                });
                
                currentJob.status = 'completed';
                currentJob.results = results;
                currentJob.completedAt = new Date().toISOString();
                console.log(`[Scheduler] Scheduled scrape job finished successfully. Found ${results.length} items.`);
                await saveToHistory(results, config.urls);
            } catch (err) {
                currentJob.status = 'error';
                currentJob.error = err.message;
                currentJob.completedAt = new Date().toISOString();
                console.error('[Scheduler] Error running scheduled scrape job:', err);
            }
        });
    } else {
        console.log('[Scheduler] Scheduler is currently disabled or has no target URLs.');
    }
};

// Initialize scheduler on server boot (only if not running on Apify Platform)
if (!process.env.APIFY_IS_AT_HOME) {
    initScheduler();
}

// --- API ROUTES ---

// 1. Trigger Scrape On-Demand
app.post('/api/scrape', async (req, res) => {
    const { urls, useProxy, crawlLinks, maxScrolls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of URLs.' });
    }

    // Save configuration parameters
    config.urls = urls;
    if (useProxy !== undefined) config.useProxy = !!useProxy;
    if (crawlLinks !== undefined) config.crawlLinks = !!crawlLinks;
    if (maxScrolls !== undefined) config.maxScrolls = Number(maxScrolls) || 0;
    saveConfig();
    
    // Re-initialize scheduler
    initScheduler();

    if (currentJob.status === 'running') {
        return res.status(400).json({ error: 'A scrape job is already running.' });
    }

    // Start crawling in background
    currentJob = {
        status: 'running',
        results: [],
        error: null,
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    res.json({ message: 'Scraping started.', job: currentJob });

    // Run scraper and update state asynchronously
    try {
        const results = await runScraper(urls, {
            useProxy: config.useProxy,
            crawlLinks: config.crawlLinks,
            maxScrolls: config.maxScrolls
        });
        currentJob.status = 'completed';
        currentJob.results = results;
        currentJob.completedAt = new Date().toISOString();
        await saveToHistory(results, urls);
    } catch (err) {
        currentJob.status = 'error';
        currentJob.error = err.message;
        currentJob.completedAt = new Date().toISOString();
        console.error('[Server] Error running on-demand scrape job:', err);
    }
});

// 2. Get Job Status
app.get('/api/status', (req, res) => {
    res.json(currentJob);
});

// 2b. Clear Current Job Status (Reset dashboard state)
app.post('/api/clear', (req, res) => {
    currentJob = {
        status: 'idle',
        results: [],
        error: null,
        startedAt: null,
        completedAt: null
    };
    res.json({ message: 'Scraper state cleared.', job: currentJob });
});

// 2c. Get Scrape Run History
app.get('/api/history', (req, res) => {
    const indexFile = path.join(HISTORY_DIR, 'index.json');
    if (!fs.existsSync(indexFile)) {
        return res.json([]);
    }
    try {
        const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
        res.json(index);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load history list.' });
    }
});

// 2d. Get Specific Historical Scrape Run results
app.get('/api/history/:id', (req, res) => {
    const { id } = req.params;
    const detailFile = path.join(HISTORY_DIR, `${id}.json`);
    if (!fs.existsSync(detailFile)) {
        return res.status(404).json({ error: 'History record not found.' });
    }
    try {
        const detail = JSON.parse(fs.readFileSync(detailFile, 'utf-8'));
        res.json(detail);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load historical results details.' });
    }
});

// 3. Get Configuration
app.get('/api/config', (req, res) => {
    res.json(config);
});

// 4. Update Configuration
app.post('/api/config', (req, res) => {
    const { urls, schedule, customCron, useProxy, crawlLinks, maxScrolls } = req.body;

    if (urls !== undefined) {
        if (!Array.isArray(urls)) {
            return res.status(400).json({ error: 'urls must be an array of strings.' });
        }
        config.urls = urls;
    }

    if (schedule !== undefined) {
        const allowedSchedules = ['none', 'hourly', 'daily', 'weekly', 'custom'];
        if (!allowedSchedules.includes(schedule)) {
            return res.status(400).json({ error: 'Invalid schedule value.' });
        }
        config.schedule = schedule;
    }

    if (customCron !== undefined) {
        if (config.schedule === 'custom' && customCron && !cron.validate(customCron)) {
            return res.status(400).json({ error: 'Invalid custom cron expression.' });
        }
        config.customCron = customCron || '';
    }

    if (useProxy !== undefined) config.useProxy = !!useProxy;
    if (crawlLinks !== undefined) config.crawlLinks = !!crawlLinks;
    if (maxScrolls !== undefined) config.maxScrolls = Number(maxScrolls) || 0;

    saveConfig();
    initScheduler();

    res.json({ message: 'Configuration updated successfully.', config });
});

// Helper: Custom CSV format generator
function convertToCSV(data) {
    if (!data || data.length === 0) return 'url,productName,priceString,price,availability,scrapedAt,error\n';
    
    const headers = ['url', 'productName', 'priceString', 'price', 'availability', 'scrapedAt', 'error'];
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const escaped = ('' + (val === null || val === undefined ? '' : val)).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

// 5. Export Datasets (JSON, CSV, Excel)
app.get('/api/export/:format', (req, res) => {
    const { format } = req.params;
    const data = currentJob.results || [];

    if (format === 'json') {
        res.setHeader('Content-Disposition', 'attachment; filename=price_tracker_results.json');
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(data, null, 2));
    } 
    
    if (format === 'csv') {
        const csv = convertToCSV(data);
        res.setHeader('Content-Disposition', 'attachment; filename=price_tracker_results.csv');
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
    } 
    
    if (format === 'xlsx') {
        const formattedData = data.map(item => ({
            URL: item.url,
            'Product Name': item.productName,
            'Price String': item.priceString,
            'Numeric Price': item.price,
            Availability: item.availability,
            'Scraped At': item.scrapedAt,
            Error: item.error || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename=price_tracker_results.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
    }

    return res.status(400).json({ error: 'Unsupported format. Use json, csv, or xlsx.' });
});

// Start Server or Apify Actor run
if (process.env.APIFY_IS_AT_HOME) {
    (async () => {
        console.log('[Apify] Actor starting on the Apify Platform...');
        await Actor.init();
        
        const input = await Actor.getInput() || {};
        const urls = input.urls || [];
        const useProxy = input.useProxy || false;
        const crawlLinks = input.crawlLinks || false;
        const maxScrolls = input.maxScrolls || 0;
        
        if (urls.length === 0) {
            console.error('[Apify] Input urls list is empty. Add URLs to scrape.');
        } else {
            console.log(`[Apify] Starting scraper for ${urls.length} URLs (Proxy: ${useProxy}, CrawlLinks: ${crawlLinks}, Scrolls: ${maxScrolls})...`);
            await runScraper(urls, { useProxy, crawlLinks, maxScrolls });
            console.log('[Apify] Scraping run complete.');
        }
        
        await Actor.exit();
    })();
} else {
    // Graceful reload check to close old ports if active
    const serverInstance = app.listen(PORT, () => {
        console.log(`[Server] E-commerce Price Tracker listening at http://localhost:${PORT}`);
    });
}
