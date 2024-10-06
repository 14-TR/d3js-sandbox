// Global variables to store the current brushed date range and selected locations
let currentBrushSelection = null;
let currentLocationSelection = new Set();
let activeEventTypes = new Set();

// Define event types and colors
const allEventTypes = [
    'Battles',
    'Explosions/Remote violence',
    'Protests',
    'Strategic developments',
    'Riots',
    'Violence against civilians'
];

const color = d3.scaleSequential()
    .domain([0, allEventTypes.length - 1])
    .interpolator(d3.interpolateTurbo);

// Fetch data and create visualizations
d3.json('data/acled_data.json').then(data => {
    if (!data || data.length === 0) {
        console.error('No data found in the JSON file.');
        return;
    }

    activeEventTypes = new Set(allEventTypes);
    d3.json('data/ukraine-boundary.geojson').then(geojson => {
        createSpikeMap(data, geojson);
        createStackedColumnChart(data);
        createLegend();
        createResetButton(data);
        initializeCollapsibleChartWindow();
    }).catch(error => {
        console.error('Error fetching GeoJSON:', error);
    });
}).catch(error => {
    console.error('Error fetching ACLED data:', error);
});

function createSpikeMap(data, geojson) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select('#ukraine-map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Set up a Mercator projection centered on Ukraine
    const projection = d3.geoMercator()
        .center([31.1656, 48.3794]) // Center coordinates of Ukraine
        .scale(3000) // Adjust scale for zoom level (increase/decrease to zoom in/out)
        .translate([width / 2, height / 2]); // Center the projection within the SVG

    const path = d3.geoPath().projection(projection);
    const zoomGroup = svg.append('g');

    // Draw Ukraine's boundary
    zoomGroup.append('g')
        .selectAll('path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', '#ddd')
        .attr('stroke', '#aaa');

    // Process data for spikes (this part remains unchanged)
    const locationData = d3.rollups(
        data,
        v => ({
            count: v.length,
            eventType: v[0].event_type
        }),
        d => d.latitude + ',' + d.longitude
    );

    const lengthScale = d3.scaleLinear()
        .domain([0, d3.max(locationData, d => d[1].count)])
        .range([0, 50]);

    // Draw spikes
    zoomGroup.append('g')
        .selectAll('path')
        .data(locationData)
        .enter()
        .append('path')
        .attr('transform', d => {
            const [lat, long] = d[0].split(',').map(Number);
            const coords = projection([long, lat]);
            return `translate(${coords[0]},${coords[1]})`;
        })
        .attr('d', d => spike(lengthScale(d[1].count)))
        .attr('fill', d => {
            const eventTypeIndex = allEventTypes.indexOf(d[1].eventType);
            return color(eventTypeIndex);
        })
        .attr('fill-opacity', 0.5)
        .attr('stroke', d => {
            const eventTypeIndex = allEventTypes.indexOf(d[1].eventType);
            return color(eventTypeIndex);
        })
        .attr('stroke-width', 0.5)
        .on('click', (event, d) => {
            const [lat, long] = d[0].split(',').map(Number);
            const locKey = `${lat},${long}`;
            if (currentLocationSelection.has(locKey)) {
                currentLocationSelection.delete(locKey);
            } else {
                currentLocationSelection.add(locKey);
            }
            updateChart(); 
        });

    // Set up zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 4])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            zoomGroup.attr('transform', event.transform);
        });

    svg.call(zoom);

    // Corrected spike function to point upwards
    function spike(length) {
        return `M0,0L2,${-length}L-2,${-length}Z`;
    }
}


// Create the stacked column chart
function createStackedColumnChart(data) {
    const processedData = d3.rollups(
        data,
        v => d3.rollup(v, d => d.length, d => d.event_type),
        d => d.event_date.slice(0, 7)
    ).map(([month, counts]) => {
        const eventCounts = { month: month };
        allEventTypes.forEach(type => {
            eventCounts[type] = counts.get(type) || 0;
        });
        return eventCounts;
    });

    const width = 1000;
    const height = 500;
    const margin = { top: 20, right: 150, bottom: 100, left: 50 };

    d3.select('#acled-chart').selectAll('*').remove();

    const svg = d3.select('#acled-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const x = d3.scaleBand()
        .domain(processedData.map(d => d.month))
        .range([margin.left, width - margin.right])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d3.sum(allEventTypes, k => d[k]))])
        .nice()
        .range([height - margin.bottom, margin.top]);

    const stack = d3.stack().keys(allEventTypes);
    let stackedData = stack(processedData);

    const groups = svg.append('g')
        .selectAll('g')
        .data(stackedData, d => d.key)
        .enter()
        .append('g')
        .attr('class', d => `bar-group ${cssSafeClass(d.key)}`);

    groups.selectAll('rect')
        .data(d => d.map(e => ({ ...e, key: d.key })))
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.data.month))
        .attr('y', d => y(d[1]))
        .attr('height', d => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .attr('fill', d => {
            const index = allEventTypes.indexOf(d.key);
            return color(index);
        })
        .attr('opacity', 1);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .attr('class', 'x-axis')
        .call(d3.axisBottom(x).tickFormat(d => d))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', margin.left - 40)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Number of Events');

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Number of Events by Month and Type');

    const brush = d3.brushX()
        .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
        .on('end', brushed);

    svg.append('g')
        .attr('class', 'brush')
        .call(brush);

    function brushed(event) {
        if (!event.selection) {
            currentBrushSelection = null;
        } else {
            const [x0, x1] = event.selection;
            currentBrushSelection = x.domain().filter(d => {
                const posX = x(d) + x.bandwidth() / 2;
                return posX >= x0 && posX <= x1;
            });
        }
        updateChart();
    }
}

// Create the legend for event types
function createLegend() {
    const legend = d3.select('#acled-chart').append('svg')
        .attr('width', 200)
        .attr('height', 150)
        .attr('transform', 'translate(820, 50)');

    allEventTypes.forEach((event_type, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`)
            .style('cursor', 'pointer')
            .on('click', () => toggleEventType(event_type));

        legendItem.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', color(i))
            .attr('class', `legend-box ${cssSafeClass(event_type)}`);

        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .text(event_type)
            .style('font-size', '12px')
            .attr('alignment-baseline', 'middle');
    });
}

// Toggle event types on the legend
function toggleEventType(event_type) {
    if (activeEventTypes.has(event_type)) {
        activeEventTypes.delete(event_type);
    } else {
        activeEventTypes.add(event_type);
    }

    d3.select(`.legend-box.${cssSafeClass(event_type)}`)
        .attr('opacity', activeEventTypes.has(event_type) ? 1 : 0.3);

    updateChart();
}

// Create a reset button for the brush
function createResetButton(data) {
    d3.select('#chart-controls').append('button')
        .text('Reset')
        .on('click', () => {
            currentBrushSelection = null;
            currentLocationSelection.clear();
            updateChart();
            createStackedColumnChart(data);
        });
}

// Update the chart based on selections
function updateChart() {
    // Implement chart updating logic based on filtering here
    console.log('Updating chart...');
}

// Initialize collapsible chart window
function initializeCollapsibleChartWindow() {
    const collapseButton = document.getElementById('collapse-button');
    const chartWindow = document.getElementById('chart-window');
    const chartContent = document.getElementById('chart-content');

    let isCollapsed = false;

    collapseButton.addEventListener('click', () => {
        if (isCollapsed) {
            chartContent.style.display = 'block';
            collapseButton.textContent = 'Collapse';
            chartWindow.style.height = '33%';
            isCollapsed = false;
        } else {
            chartContent.style.display = 'none';
            collapseButton.textContent = 'Expand';
            chartWindow.style.height = 'auto';
            isCollapsed = true;
        }
    });
}

// Utility function to create CSS-safe class names
function cssSafeClass(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-');
}
