// Global variables to store the current brushed date range and selected locations
let currentBrushSelection = null;
let currentLocationSelection = new Set();

// Fetch the ACLED data and the GeoJSON for Ukraine
d3.json('data/acled_data.json').then(data => {
    console.log('Raw data loaded:', data);

    if (!data || data.length === 0) {
        console.error('No data found in the JSON file.');
        return;
    }

    // Load geographical data for Ukraine
    d3.json('data/ukraine-boundary.geojson').then(geojson => {
        createSpikeMap(data, geojson);
        createStackedColumnChart(data);
    });
}).catch(error => {
    console.error('Error fetching data:', error);
});

// Create the spike map for Ukraine
function createSpikeMap(data, geojson) {
    // Set up map dimensions and projection
    const width = 500;
    const height = 500;

    const svg = d3.select('#ukraine-map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Set up a Mercator projection centered on Ukraine
    const projection = d3.geoMercator()
        .center([31.1656, 48.3794]) // Center coordinates of Ukraine
        .scale(2500) // Adjust scale for a closer zoom into Ukraine
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Draw the boundary of Ukraine
    svg.append('g')
        .selectAll('path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('fill', '#ddd')
        .attr('stroke', '#aaa');

    // Disable zooming and panning
    const zoom = d3.zoom()
        .scaleExtent([1, 1]) // Prevent zooming
        .on('zoom', () => { /* Do nothing */ });

    svg.call(zoom);

    // Process data to calculate the number of events per location
    const locationData = d3.rollups(
        data,
        v => v.length, // Count the number of events
        d => d.latitude + ',' + d.longitude // Group by lat/long
    );

    // Define a scale for spike height
    const lengthScale = d3.scaleLinear()
        .domain([0, d3.max(locationData, d => d[1])])
        .range([0, 50]);

    // Draw spikes on the map
    svg.append('g')
        .selectAll('path')
        .data(locationData)
        .enter()
        .append('path')
        .attr('transform', d => {
            const [lat, long] = d[0].split(',').map(Number);
            const coords = projection([long, lat]);
            return `translate(${coords[0]},${coords[1]})`;
        })
        .attr('d', d => spike(lengthScale(d[1])))
        .attr('fill', 'red')
        .attr('fill-opacity', 0.5)
        .attr('stroke', 'red')
        .attr('stroke-width', 0.5)
        .on('click', (event, d) => {
            // Handle spike click to filter the chart
            const [lat, long] = d[0].split(',').map(Number);
            const locKey = `${lat},${long}`;

            if (currentLocationSelection.has(locKey)) {
                currentLocationSelection.delete(locKey);
            } else {
                currentLocationSelection.add(locKey);
            }

            updateChart(); // Update chart with the selected locations
        });

    // Function to create a spike shape
    function spike(length) {
        return `M0,0L${-2},${-length}L${2},${-length}Z`;
    }
}

// Create the stacked column chart
function createStackedColumnChart(data) {
    // [Existing stacked column chart implementation...]
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

    const processedData = d3.rollups(
        data,
        v => d3.rollup(v, d => d.length, d => d.event_type),
        d => d.event_date.slice(0, 7) // Extract "YYYY-MM" to group by month
    ).map(([month, counts]) => {
        const eventCounts = { month: month };
        allEventTypes.forEach(type => {
            eventCounts[type] = counts.get(type) || 0; // Fill missing event types with 0
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

    function updateChart() {
        const filteredMonths = currentBrushSelection || processedData.map(d => d.month);
        const filteredData = processedData.filter(d => filteredMonths.includes(d.month));
        const filteredKeys = Array.from(activeEventTypes);
        const newStack = d3.stack().keys(filteredKeys);
        const newStackedData = newStack(filteredData);

        const groupUpdate = svg.selectAll('.bar-group')
            .data(newStackedData, d => d.key);

        const newGroups = groupUpdate.enter().append('g')
            .attr('class', d => `bar-group ${cssSafeClass(d.key)}`);

        newGroups.merge(groupUpdate).each(function(d) {
            const rects = d3.select(this).selectAll('rect')
                .data(d.map(e => ({ ...e, key: d.key })));

            rects.enter()
                .append('rect')
                .attr('class', 'bar')
                .merge(rects)
                .attr('x', d => x(d.data.month))
                .attr('y', d => y(d[1]))
                .attr('height', d => y(d[0]) - y(d[1]))
                .attr('width', x.bandwidth())
                .attr('fill', d => {
                    const index = allEventTypes.indexOf(d.key);
                    return color(index);
                })
                .attr('opacity', d => activeEventTypes.has(d.key) ? 1 : 0);

            rects.exit().remove();
        });

        groupUpdate.exit().remove();

        svg.select('.x-axis')
            .call(d3.axisBottom(x).tickFormat(d => d))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');
    }

    const activeEventTypes = new Set(allEventTypes);
    function cssSafeClass(name) {
        return name.replace(/[^a-zA-Z0-9_-]/g, '-');
    }
}
