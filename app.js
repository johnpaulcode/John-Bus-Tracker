const allStops = [
    // --- Journey from Home ---
    // Buses
    { name: "South Norwood Clock Tower", id: "490012320A", letter: "A", direction: "South Norwood towards Purley David Lloyd", lines: ["157"], type: "bus", category: "fromHome" },
    { name: "Cromwell Road", id: "490013376S", letter: "H", direction: "Alison work to Purley David Lloyd", lines: ["157"], type: "bus", category: "fromHome" },
    { name: "Derwent Road", id: "490006061W", letter: "N", direction: "Towards Beckenham David Lloyd", lines: ["356"], type: "bus", category: "fromHome" },
    { name: "Nugent Road", id: "490014601S", letter: "SP", direction: "Home towards Croydon", lines: ["468"], type: "bus", category: "fromHome" },
    { name: "Howden Road", id: "490008410N", letter: "NA", direction: "Home towards Elephant & Castle", lines: ["468", "196"], type: "bus", category: "fromHome" },
    // Trains
    {
        name: "Norwood Junction",
        id: "910GNORWDJ",
        type: "train",
        direction: "Thameslink to Farringdon",
        category: "fromHome",
        filter: arrival => !(arrival.destinationName || "").includes("Three Bridges")
    },
    {
        name: "West Harrow",
        id: "940GZZLUWHW",
        type: "tube",
        direction: "Met Line towards Farringdon",
        category: "toHome",
        filter: arrival => arrival.lineName === "Metropolitan" && ((arrival.platformName || "").includes("Southbound") || (arrival.platformName || "").includes("Platform 2"))
    },

    // --- Journey to Home ---
    // Buses
    { name: "Pawsons Road", id: "490010868N", letter: "T", direction: "Alison work towards Home", lines: ["468"], type: "bus", category: "toHome" },
    { name: "Hannibal Way", id: "490007755E", letter: "", direction: "Purley David Lloyd towards South Norwood", lines: ["157"], type: "bus", category: "toHome" },
    { name: "Altyre Way", id: "490013532W", letter: "", direction: "Beckenham David Lloyd towards Home", lines: ["356"], type: "bus", category: "toHome" },
    // Trains
    {
        name: "Farringdon",
        id: "940GZZLUFCN",
        type: "tube",
        direction: "Met Line to Harrow",
        category: "fromHome",
        filter: arrival => arrival.lineName === "Metropolitan" && !(arrival.destinationName || "").includes("Aldgate")
    },
    {
        name: "Farringdon",
        id: "910GFRNDNLT",
        type: "train",
        direction: "Thameslink towards Norwood Jct",
        category: "toHome",
        filter: arrival => (arrival.platformName || "").includes("Platform 3") && (arrival.destinationName || "").includes("Three Bridges")
    }
];

const TFL_APP_KEY = 'e536138153af49e786cd98d404228dcd';

let activeTab = 'fromHome';  // 'fromHome' or 'toHome'
let activeSubTab = 'bus';    // 'bus' or 'train'

const app = document.getElementById('app');
const refreshBtn = document.getElementById('refresh-btn');
const pageTitle = document.querySelector('header h1');
const tabFrom = document.getElementById('tab-from');
const tabTo = document.getElementById('tab-to');
const subtabBus = document.getElementById('subtab-bus');
const subtabTrain = document.getElementById('subtab-train');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchArrivals(stop) {
    try {
        const keyParam = TFL_APP_KEY ? `app_key=${TFL_APP_KEY}` : '';
        if (stop.type === 'train') {
            const url = `https://api.tfl.gov.uk/StopPoint/${stop.id}/ArrivalDepartures?lineIds=thameslink` + (keyParam ? `&${keyParam}` : '');
            const response = await fetch(url);
            if (!response.ok) throw new Error('ArrivalDepartures response was not ok');
            const data = await response.json();
            
            // Map ArrivalDeparture schema to standard arrivals schema
            return (data || []).map(item => {
                const depTime = item.estimatedTimeOfDeparture || item.scheduledTimeOfDeparture;
                const depDate = depTime ? new Date(depTime) : new Date();
                const now = new Date();
                const timeToStation = depTime ? Math.max(0, Math.floor((depDate - now) / 1000)) : 0;
                const rawDest = item.destinationName && item.destinationName !== 'None' ? item.destinationName : (item.towards || '');
                
                return {
                    lineName: "Thameslink",
                    destinationName: rawDest.replace(' Rail Station', ''),
                    timeToStation: timeToStation,
                    expectedArrival: depTime || "",
                    platformName: item.platformName || ""
                };
            });
        } else {
            const url = `https://api.tfl.gov.uk/StopPoint/${stop.id}/Arrivals` + (keyParam ? `?${keyParam}` : '');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Arrivals response was not ok');
            const data = await response.json();
            
            return (data || []).map(item => {
                const rawDest = item.destinationName && item.destinationName !== 'None' ? item.destinationName : (item.towards || '');
                return {
                    lineName: item.lineName || "",
                    destinationName: rawDest.replace(' Underground Station', '').replace(' Rail Station', ''),
                    timeToStation: item.timeToStation || 0,
                    expectedArrival: item.expectedArrival || "",
                    platformName: item.platformName || ""
                };
            });
        }
    } catch (error) {
        console.error(`Error fetching data for ${stop.name}:`, error);
        return [];
    }
}

function processArrivals(arrivals) {
    // Sort by time to station (ascending)
    return arrivals.sort((a, b) => a.timeToStation - b.timeToStation);
}

function formatTime(seconds) {
    if (seconds < 60) return 'Due';
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
}

function formatExpectedTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatPlatform(platform) {
    if (!platform) return '';
    const clean = platform.trim();
    if (clean === 'null' || clean === 'Platform Unknown' || clean.toLowerCase() === 'undefined') return '';
    return clean;
}

function getLineColor(lineName) {
    if (!lineName) return '#475569';
    const line = lineName.toLowerCase();
    if (line.includes('metropolitan')) return '#9b0056';
    if (line.includes('thameslink')) return '#00a4e4';
    if (line.includes('elizabeth')) return '#9364cc';
    if (line.includes('overground') || line.includes('windrush')) return '#e86a10';
    if (/^\d/.test(line)) return '#dc241f'; // TfL Bus Red
    return '#64748b'; // default gray
}

async function render() {
    refreshBtn.textContent = '...';
    refreshBtn.disabled = true;

    pageTitle.textContent = activeTab === 'fromHome' ? 'Journey from Home' : 'Journey to Home';

    const activeType = activeSubTab === 'bus' ? 'bus' : ['train', 'tube'];
    const currentStops = allStops.filter(stop => 
        stop.category === activeTab && 
        (Array.isArray(activeType) ? activeType.includes(stop.type) : stop.type === activeType)
    );

    const stopPromises = currentStops.map(async (stop, index) => {
        await sleep(index * 100); // Stagger calls
        let arrivals = await fetchArrivals(stop);
        
        // Apply filters
        if (stop.filter) {
            arrivals = arrivals.filter(stop.filter);
        } else if (stop.lines) {
            arrivals = arrivals.filter(bus => stop.lines.includes(bus.lineName));
        }

        let sortedArrivals = processArrivals(arrivals);
        sortedArrivals = sortedArrivals.slice(0, 5); // Show next 5 arrivals

        return `
            <div class="stop-card">
                <div class="stop-header">
                    <h2>
                        ${stop.direction}
                    </h2>
                    <div class="stop-name-container">
                        ${stop.letter ? `<span class="stop-letter">${stop.letter}</span>` : ''}
                        <span class="stop-name-text">${stop.name}</span>
                    </div>
                </div>
                <ul class="arrival-list">
                    ${sortedArrivals.length > 0 ? sortedArrivals.map(bus => `
                        <li class="arrival-item">
                            <span class="bus-number" style="background-color: ${getLineColor(bus.lineName)}">${bus.lineName}</span>
                            <div class="bus-destination-container">
                                <span class="bus-destination">${bus.destinationName}</span>
                                ${formatPlatform(bus.platformName) ? `<span class="bus-platform">${formatPlatform(bus.platformName)}</span>` : ''}
                            </div>
                            <span class="bus-time ${formatTime(bus.timeToStation) === 'Due' ? 'due' : ''}">
                                <span>${formatTime(bus.timeToStation)}</span>
                                <span class="expected-time">${formatExpectedTime(bus.expectedArrival)}</span>
                            </span>
                        </li>
                    `).join('') : `<li class="arrival-item">No ${activeSubTab === 'bus' ? 'buses' : 'trains'} found.</li>`}
                </ul>
            </div>
        `;
    });

    const stopHtmls = await Promise.all(stopPromises);
    app.innerHTML = stopHtmls.join('');

    refreshBtn.textContent = '↻ Refresh';
    refreshBtn.disabled = false;
}

// Tab Switching Listeners
tabFrom.addEventListener('click', () => {
    if (activeTab !== 'fromHome') {
        activeTab = 'fromHome';
        tabFrom.classList.add('active');
        tabTo.classList.remove('active');
        render();
    }
});

tabTo.addEventListener('click', () => {
    if (activeTab !== 'toHome') {
        activeTab = 'toHome';
        tabTo.classList.add('active');
        tabFrom.classList.remove('active');
        render();
    }
});

subtabBus.addEventListener('click', () => {
    if (activeSubTab !== 'bus') {
        activeSubTab = 'bus';
        subtabBus.classList.add('active');
        subtabTrain.classList.remove('active');
        render();
    }
});

subtabTrain.addEventListener('click', () => {
    if (activeSubTab !== 'train') {
        activeSubTab = 'train';
        subtabTrain.classList.add('active');
        subtabBus.classList.remove('active');
        render();
    }
});

// Initial load
render();

// Auto refresh every 30 seconds
setInterval(render, 30000);

// Manual refresh
refreshBtn.addEventListener('click', render);
