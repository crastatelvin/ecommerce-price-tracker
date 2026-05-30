// Client-Side Javascript - Premium E-commerce Price Tracker Dashboard

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const urlInputs = document.getElementById('url-inputs');
    const customCronGroup = document.getElementById('custom-cron-group');
    const customCronInput = document.getElementById('custom-cron');
    
    // Advanced Elements
    const toggleAdvancedOpts = document.getElementById('toggle-advanced-opts');
    const advancedPanel = document.getElementById('advanced-panel');
    const optUseProxy = document.getElementById('opt-use-proxy');
    const optCrawlLinks = document.getElementById('opt-crawl-links');
    const optMaxScrolls = document.getElementById('opt-max-scrolls');
    
    const btnSaveConfig = document.getElementById('btn-save-config');
    const btnRunScraper = document.getElementById('btn-run-scraper');
    const runSpinner = document.getElementById('run-spinner');
    const runText = document.getElementById('run-text');
    
    const jobStatusBadge = document.getElementById('job-status');
    const jobStartTime = document.getElementById('job-start-time');
    const jobEndTime = document.getElementById('job-end-time');
    
    // Preview Analytics & Tables/Grid Elements
    const itemCount = document.getElementById('item-count');
    const resultsTbody = document.getElementById('results-tbody');
    const gridViewContainer = document.getElementById('grid-view-container');
    const tableViewContainer = document.getElementById('table-view-container');
    
    const metricTotal = document.getElementById('metric-total');
    const metricInStock = document.getElementById('metric-instock');
    const metricOutStock = document.getElementById('metric-outstock');
    const metricAvgPrice = document.getElementById('metric-avgprice');
    
    const searchInput = document.getElementById('search-input');
    const filterChips = document.querySelectorAll('.filter-chip');
    const viewBtnTable = document.getElementById('view-btn-table');
    const viewBtnGrid = document.getElementById('view-btn-grid');
    
    // State Variables
    let allResults = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let activeView = 'table';
    let activeSchedule = 'none';
    let pollInterval = null;

    // Segmented Controls Event Bindings
    const segmentTabs = document.querySelectorAll('#schedule-segmented .segment-tab');
    segmentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            segmentTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeSchedule = tab.getAttribute('data-value');
            
            if (activeSchedule === 'custom') {
                customCronGroup.classList.remove('hidden');
            } else {
                customCronGroup.classList.add('hidden');
            }
        });
    });

    // Toggle advanced options panel
    toggleAdvancedOpts.addEventListener('change', () => {
        if (toggleAdvancedOpts.checked) {
            advancedPanel.classList.remove('hidden');
        } else {
            advancedPanel.classList.add('hidden');
        }
    });

    // View Switching Toggles (Table vs Grid Card)
    viewBtnTable.addEventListener('click', () => {
        activeView = 'table';
        viewBtnTable.classList.add('active');
        viewBtnGrid.classList.remove('active');
        tableViewContainer.classList.remove('hidden');
        gridViewContainer.classList.add('hidden');
        renderResults();
    });

    viewBtnGrid.addEventListener('click', () => {
        activeView = 'grid';
        viewBtnGrid.classList.add('active');
        viewBtnTable.classList.remove('active');
        gridViewContainer.classList.remove('hidden');
        tableViewContainer.classList.add('hidden');
        renderResults();
    });

    // Real-time Text Search Input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderResults();
    });

    // Filtering Chip buttons
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.getAttribute('data-filter');
            renderResults();
        });
    });

    // Helper: Parse text area into array of URLs
    const getUrlsArray = () => {
        return urlInputs.value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    };

    // Helper: Format ISO date string nicely
    const formatTime = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString();
    };

    // Render Scraped Data inside the preview table and grid view
    const renderResults = () => {
        // Filter the dataset based on active filters and search keyword
        const filtered = allResults.filter(item => {
            const matchesSearch = (item.productName || '').toLowerCase().includes(searchQuery);
            
            let matchesFilter = true;
            if (activeFilter === 'instock') {
                matchesFilter = item.availability === 'In Stock';
            } else if (activeFilter === 'outstock') {
                matchesFilter = item.availability === 'Out of Stock';
            } else if (activeFilter === 'error') {
                matchesFilter = item.availability === 'Error' || !!item.error;
            }
            
            return matchesSearch && matchesFilter;
        });

        itemCount.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''} shown`;

        // Calculate and update metrics values dynamically
        updateMetrics(allResults);

        // 1. Render Table View
        if (filtered.length === 0) {
            resultsTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">No matching products found. Try adjustments or scraping.</td>
                </tr>
            `;
        } else {
            resultsTbody.innerHTML = filtered.map(item => {
                let badgeClass = 'badge-stock-unknown';
                if (item.availability === 'In Stock') badgeClass = 'badge-stock-in';
                if (item.availability === 'Out of Stock') badgeClass = 'badge-stock-out';

                const name = item.productName || 'Unknown';
                const price = item.priceString || 'N/A';
                const time = formatTime(item.scrapedAt);
                const errorLabel = item.error ? `<br><small style="color:var(--accent-red)">${item.error}</small>` : '';

                return `
                    <tr>
                        <td><strong style="color:#ffffff">${name}</strong>${errorLabel}</td>
                        <td><a class="table-url" href="${item.url}" target="_blank" title="${item.url}">${item.url}</a></td>
                        <td class="table-price">${price}</td>
                        <td><span class="${badgeClass}">${item.availability}</span></td>
                        <td style="color:var(--text-secondary)">${time}</td>
                    </tr>
                `;
            }).join('');
        }

        // 2. Render Cards Grid View
        if (filtered.length === 0) {
            gridViewContainer.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No matching products found.</div>`;
        } else {
            gridViewContainer.innerHTML = filtered.map(item => {
                let badgeClass = 'badge-stock-unknown';
                if (item.availability === 'In Stock') badgeClass = 'badge-stock-in';
                if (item.availability === 'Out of Stock') badgeClass = 'badge-stock-out';

                const name = item.productName || 'Unknown';
                const price = item.priceString || 'N/A';
                const time = formatTime(item.scrapedAt);
                const errorText = item.error ? `<div style="font-size:0.75rem; color:var(--accent-red); margin-top:0.25rem;">${item.error}</div>` : '';

                return `
                    <div class="product-card">
                        <div class="product-card-top">
                            <span class="${badgeClass}" style="align-self: flex-start;">${item.availability}</span>
                            <h3 class="product-card-title" title="${name}">${name}</h3>
                            <a class="product-card-url" href="${item.url}" target="_blank" title="${item.url}">${item.url}</a>
                            ${errorText}
                        </div>
                        <div class="product-card-bottom">
                            <div class="product-card-price-box">
                                <span class="product-card-price-label">Price</span>
                                <span class="product-card-price">${price}</span>
                            </div>
                            <div class="product-card-meta">
                                <span class="product-card-time">${time}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    };

    // Calculate Summary metrics
    const updateMetrics = (results) => {
        if (!results || results.length === 0) {
            metricTotal.textContent = '0';
            metricInStock.textContent = '0';
            metricOutStock.textContent = '0';
            metricAvgPrice.textContent = 'N/A';
            return;
        }

        const total = results.length;
        const inStockCount = results.filter(item => item.availability === 'In Stock').length;
        const outStockCount = results.filter(item => item.availability === 'Out of Stock' || item.availability === 'Error').length;
        
        // Compute average price from items that have numeric prices
        const priceItems = results.filter(item => item.price !== null && typeof item.price === 'number');
        let avgFormatted = 'N/A';
        if (priceItems.length > 0) {
            const sum = priceItems.reduce((acc, curr) => acc + curr.price, 0);
            const avg = sum / priceItems.length;
            
            // Format to 2 decimal places with currency symbol ($ or standard representation)
            avgFormatted = avg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            // Add a currency symbol based on parsed string if possible, default to dollar/locale
            const firstWithSymbol = results.find(item => item.priceString && item.priceString.match(/[$₹€£]/));
            const symbol = firstWithSymbol ? firstWithSymbol.priceString.match(/[$₹€£]/)[0] : '';
            avgFormatted = `${symbol}${avgFormatted}`;
        }

        metricTotal.textContent = total;
        metricInStock.textContent = inStockCount;
        metricOutStock.textContent = outStockCount;
        metricAvgPrice.textContent = avgFormatted;
    };

    // Update Status elements
    const updateStatusUI = (status, startedAt, completedAt) => {
        jobStatusBadge.textContent = status;
        jobStatusBadge.className = 'badge'; // reset
        
        if (status === 'running') {
            jobStatusBadge.classList.add('badge-running');
            btnRunScraper.disabled = true;
            runSpinner.classList.remove('hidden');
            runText.textContent = 'Scraping...';
        } else if (status === 'completed') {
            jobStatusBadge.classList.add('badge-completed');
            btnRunScraper.disabled = false;
            runSpinner.classList.add('hidden');
            runText.textContent = 'Run Tracker Now';
        } else if (status === 'error') {
            jobStatusBadge.classList.add('badge-error');
            btnRunScraper.disabled = false;
            runSpinner.classList.add('hidden');
            runText.textContent = 'Run Tracker Now';
        } else {
            jobStatusBadge.classList.add('badge-idle');
            btnRunScraper.disabled = false;
            runSpinner.classList.add('hidden');
            runText.textContent = 'Run Tracker Now';
        }

        jobStartTime.textContent = formatTime(startedAt);
        jobEndTime.textContent = formatTime(completedAt);
    };

    // Poll current job status from server
    const pollStatus = () => {
        fetch('/api/status')
            .then(res => res.json())
            .then(job => {
                updateStatusUI(job.status, job.startedAt, job.completedAt);
                
                if (job.status === 'completed' || job.status === 'error') {
                    allResults = job.results || [];
                    renderResults();
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            })
            .catch(err => {
                console.error('[App] Error polling status:', err);
                clearInterval(pollInterval);
                pollInterval = null;
            });
    };

    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(pollStatus, 2000);
        pollStatus();
    };

    // 1. Initial configuration load from server
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            // Load URLs
            if (data.urls && data.urls.length > 0) {
                urlInputs.value = data.urls.join('\n');
            }
            
            // Set segmented schedule tab
            const schedule = data.schedule || 'none';
            const targetTab = document.querySelector(`#schedule-segmented .segment-tab[data-value="${schedule}"]`);
            if (targetTab) {
                segmentTabs.forEach(t => t.classList.remove('active'));
                targetTab.classList.add('active');
                activeSchedule = schedule;
            }
            
            // Load custom cron
            if (data.customCron) {
                customCronInput.value = data.customCron;
            }

            // Load advanced settings
            optUseProxy.checked = !!data.useProxy;
            optCrawlLinks.checked = !!data.crawlLinks;
            optMaxScrolls.value = data.maxScrolls || 0;

            if (data.useProxy || data.crawlLinks || (data.maxScrolls && data.maxScrolls > 0)) {
                toggleAdvancedOpts.checked = true;
                advancedPanel.classList.remove('hidden');
            }
            
            if (activeSchedule === 'custom') {
                customCronGroup.classList.remove('hidden');
            } else {
                customCronGroup.classList.add('hidden');
            }
            
            // Get initial job status
            return fetch('/api/status');
        })
        .then(res => res.json())
        .then(job => {
            updateStatusUI(job.status, job.startedAt, job.completedAt);
            allResults = job.results || [];
            renderResults();
            
            if (job.status === 'running') {
                startPolling();
            }
        })
        .catch(err => console.error('[App] Error loading initial configuration:', err));

    // 2. Save config button event handler
    btnSaveConfig.addEventListener('click', () => {
        const urls = getUrlsArray();
        const schedule = activeSchedule;
        const customCron = customCronInput.value.trim();
        const useProxy = optUseProxy.checked;
        const crawlLinks = optCrawlLinks.checked;
        const maxScrolls = Number(optMaxScrolls.value) || 0;

        if (schedule === 'custom' && !customCron) {
            alert('Please specify a cron expression for custom scheduling.');
            return;
        }

        btnSaveConfig.disabled = true;
        btnSaveConfig.textContent = 'Saving...';

        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, schedule, customCron, useProxy, crawlLinks, maxScrolls })
        })
        .then(res => {
            if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Failed to save configuration') });
            return res.json();
        })
        .then(data => {
            alert('Schedule configuration saved successfully!');
        })
        .catch(err => {
            alert('Error: ' + err.message);
        })
        .finally(() => {
            btnSaveConfig.disabled = false;
            btnSaveConfig.textContent = 'Save Schedule Config';
        });
    });

    // 3. Run Scraper Now button event handler
    btnRunScraper.addEventListener('click', () => {
        const urls = getUrlsArray();
        const useProxy = optUseProxy.checked;
        const crawlLinks = optCrawlLinks.checked;
        const maxScrolls = Number(optMaxScrolls.value) || 0;

        if (urls.length === 0) {
            alert('Please enter at least one URL before running.');
            return;
        }

        updateStatusUI('running', new Date().toISOString(), null);
        
        allResults = [];
        renderResults();
        
        resultsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">Scraping process initiated. This may take a few moments...</td>
            </tr>
        `;
        gridViewContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">Scraping process initiated. This may take a few moments...</div>
        `;

        fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, useProxy, crawlLinks, maxScrolls })
        })
        .then(res => {
            if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Failed to trigger scrape') });
            return res.json();
        })
        .then(data => {
            startPolling();
        })
        .catch(err => {
            alert('Error starting scrape: ' + err.message);
            updateStatusUI('error', null, new Date().toISOString());
        });
    });
});
