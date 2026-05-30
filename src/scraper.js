import { PlaywrightCrawler, Dataset, ProxyConfiguration } from 'crawlee';

/**
 * Run the e-commerce price tracker crawler on an array of URLs with advanced parameters.
 * @param {string[]} urls - The list of product or listing URLs to scrape.
 * @param {Object} [options] - Crawling options.
 * @param {boolean} [options.useProxy] - Whether to utilize proxy rotation.
 * @param {boolean} [options.crawlLinks] - Whether to find and crawl product links on listing pages.
 * @param {number} [options.maxScrolls] - Maximum scroll actions to load dynamic elements (infinite scroll).
 * @param {string} [options.datasetId] - Optional dataset ID.
 * @returns {Promise<Array>} - The array of scraped product items.
 */
export async function runScraper(urls, options = {}) {
    const results = [];
    const datasetId = options.datasetId;
    const maxScrolls = Number(options.maxScrolls) || 0;

    // 1. Configure Proxies (Module 6)
    let proxyConfiguration = undefined;
    if (options.useProxy) {
        try {
            proxyConfiguration = new ProxyConfiguration({
                useApifyProxy: true,
            });
            console.log('[Scraper] Enabled Apify Proxy configuration.');
        } catch (err) {
            console.warn('[Scraper] Could not initialize Apify proxy, running without proxy:', err.message);
        }
    }

    const crawler = new PlaywrightCrawler({
        proxyConfiguration,
        launchContext: {
            launchOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            },
        },
        maxConcurrency: 3,
        requestHandlerTimeoutSecs: 45,
        navigationTimeoutSecs: 30,
        maxRequestsPerCrawl: options.crawlLinks ? 10 : undefined,
        
        async requestHandler({ page, request, enqueueLinks }) {
            console.log(`[Scraper] Processing URL: ${request.url}`);
            
            try {
                await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            } catch (e) {
                console.log(`[Scraper] Timeout waiting for DOM, continuing: ${e.message}`);
            }

            // 2. Handle Infinite Scroll (Module 5)
            if (maxScrolls > 0) {
                console.log(`[Scraper] Scrolling page ${maxScrolls} times...`);
                for (let i = 0; i < maxScrolls; i++) {
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await page.waitForTimeout(1200); // Allow content to lazy load
                }
            } else {
                await page.waitForTimeout(3000); // Standard brief wait
            }

            // 3. Extract product page links if listing/category crawling is enabled (Module 4 & 11)
            let extractedProductUrls = [];
            if (options.crawlLinks) {
                extractedProductUrls = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
                    
                    // Patterns matching typical product page details
                    const productPatterns = [
                        /\/products?\/[^/]+$/,
                        /\/product\/[^/]+$/,
                        /\/item\/[^/]+$/,
                        /\/p\/[^/]+$/,
                        /\/dp\/[A-Z0-9]{10}/,
                        /\/gp\/product\/[A-Z0-9]{10}/
                    ];
                    
                    const currentOrigin = window.location.origin;
                    const filtered = links.filter(href => {
                        try {
                            const url = new URL(href);
                            // Keep crawler on the same domain
                            if (url.origin !== currentOrigin) return false;
                            
                            const pathname = url.pathname;
                            return productPatterns.some(pattern => pattern.test(pathname));
                        } catch (e) {
                            return false;
                        }
                    });
                    
                    return Array.from(new Set(filtered));
                });
                
                if (extractedProductUrls.length > 0) {
                    console.log(`[Scraper] Extracted ${extractedProductUrls.length} sub-product URLs from listing.`);
                    // Enqueue links as enqueued pages
                    await enqueueLinks({
                        urls: extractedProductUrls,
                        userData: { isEnqueued: true }
                    });
                }
            }

            // 4. Extract Structured Product Data
            const pageData = await page.evaluate(() => {
                let name = '';
                let price = '';
                let availability = 'Unknown';

                // Try JSON-LD schemas
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of jsonLdScripts) {
                    try {
                        const json = JSON.parse(script.textContent || '');
                        
                        const findProduct = (obj) => {
                            if (!obj || typeof obj !== 'object') return null;
                            if (obj['@type'] === 'Product') return obj;
                            if (Array.isArray(obj)) {
                                for (const item of obj) {
                                    const res = findProduct(item);
                                    if (res) return res;
                                }
                            }
                            if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                                for (const item of obj['@graph']) {
                                    const res = findProduct(item);
                                    if (res) return res;
                                }
                            }
                            return null;
                        };

                        const product = findProduct(json);
                        if (product) {
                            if (product.name) name = product.name;
                            if (product.offers) {
                                const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                                if (offer && offer.price) {
                                    price = String(offer.price);
                                }
                                if (offer && offer.availability) {
                                    const avail = String(offer.availability);
                                    if (avail.includes('InStock') || avail.includes('InStockLimit')) {
                                        availability = 'In Stock';
                                    } else if (avail.includes('OutOfStock') || avail.includes('SoldOut')) {
                                        availability = 'Out of Stock';
                                    }
                                }
                            }
                            break;
                        }
                    } catch (e) {
                        // ignore parsing error
                    }
                }

                // Meta tag fallback
                if (!name) {
                    const ogTitle = document.querySelector('meta[property="og:title"]') || document.querySelector('meta[name="twitter:title"]');
                    if (ogTitle) name = ogTitle.getAttribute('content') || '';
                }
                if (!price) {
                    const ogPrice = document.querySelector('meta[property="product:price:amount"]') || 
                                    document.querySelector('meta[property="og:price:amount"]') ||
                                    document.querySelector('meta[name="twitter:data1"]');
                    if (ogPrice) price = ogPrice.getAttribute('content') || ogPrice.getAttribute('value') || '';
                }

                // CSS Selector fallback
                if (!name) {
                    const titleSelectors = ['#productTitle', '.product-title', '.product-name', 'h1'];
                    for (const sel of titleSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.textContent) {
                            name = el.textContent.trim();
                            break;
                        }
                    }
                }

                if (!price) {
                    const priceSelectors = [
                        '#priceblock_ourprice', '#priceblock_dealprice', '.a-price .a-offscreen',
                        '[itemprop="price"]', '.price', '.product-price', '.current-price', '.amount'
                    ];
                    for (const sel of priceSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.textContent) {
                            price = el.textContent.trim();
                            break;
                        }
                    }
                }

                // Stock status fallback
                if (availability === 'Unknown') {
                    const availSelectors = ['#availability', '.availability', '.in-stock', '.out-of-stock', '.instock'];
                    for (const sel of availSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.textContent) {
                            const text = el.textContent.toLowerCase();
                            if (text.includes('in stock') || text.includes('available')) {
                                availability = 'In Stock';
                                break;
                            } else if (text.includes('out of stock') || text.includes('sold out')) {
                                availability = 'Out of Stock';
                                break;
                            }
                        }
                    }
                }

                return { name, price, availability };
            });

            // Clean data values
            const nameClean = pageData.name ? pageData.name.trim().replace(/\s+/g, ' ') : 'Unknown Product';
            let priceClean = pageData.price ? pageData.price.trim() : 'N/A';
            const availabilityClean = pageData.availability || 'Unknown';

            let numericPrice = null;
            if (priceClean !== 'N/A') {
                const stripped = priceClean.replace(/[^0-9.]/g, '');
                const floatVal = parseFloat(stripped);
                if (!isNaN(floatVal)) {
                    numericPrice = floatVal;
                }
            }

            const scrapedItem = {
                url: request.url,
                productName: nameClean,
                priceString: priceClean,
                price: numericPrice,
                availability: availabilityClean,
                scrapedAt: new Date().toISOString()
            };

            const isEnqueued = request.userData && request.userData.isEnqueued;
            const hasProductData = nameClean !== 'Unknown Product' && priceClean !== 'N/A';

            // Filter out index/listing pages from the dataset that were automatically enqueued
            if (isEnqueued && !hasProductData) {
                console.log(`[Scraper] Skipping saving listing link: ${request.url}`);
                return;
            }

            console.log(`[Scraper] Extracted: "${nameClean}" - ${priceClean} - ${availabilityClean}`);
            results.push(scrapedItem);

            const dataset = datasetId ? await Dataset.open(datasetId) : await Dataset.open();
            await dataset.pushData(scrapedItem);
        },

        async failedRequestHandler({ request }) {
            console.error(`[Scraper] Request failed ${request.url}`);
            
            // Only write failures for user-provided URLs to avoid clogging the dataset with enqueued bad links
            const isEnqueued = request.userData && request.userData.isEnqueued;
            if (isEnqueued) return;

            const failedItem = {
                url: request.url,
                productName: 'Error: Failed to fetch/parse page',
                priceString: 'N/A',
                price: null,
                availability: 'Error',
                scrapedAt: new Date().toISOString(),
                error: request.errorMessages[0] || 'Page request failed'
            };
            results.push(failedItem);
            
            const dataset = datasetId ? await Dataset.open(datasetId) : await Dataset.open();
            await dataset.pushData(failedItem);
        }
    });

    // Run the crawler
    await crawler.run(urls);
    return results;
}
