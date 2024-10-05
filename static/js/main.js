// Fetch the ACLED data from the JSON file
d3.json('data/acled_data.json').then(data => {
    console.log('Raw data loaded:', data);

    if (!data || data.length === 0) {
        console.error('No data found in the JSON file.');
        return;
    }

    // Call the function to create the stacked column chart with toggling
    createStackedColumnChart(data);
}).catch(error => {
    console.error('Error fetching ACLED data:', error);
});

function createStackedColumnChart(data) {
    // Step 1: Group data by month (YYYY-MM) and count occurrences of each event type
    const nestedData = d3.rollups(
        data,
        v => d3.rollup(v, d => d.length, d => d.event_type),
        d => d.event_date.slice(0, 7) // Extract "YYYY-MM" to group by month
    );

    // Step 2: Define the event types and set up the color scale
    const allEventTypes = [
        'Battles',
        'Explosions/Remote violence',
        'Protests',
        'Strategic developments',
        'Riots',
        'Violence against civilians'
    ];

    const color = d3.scaleOrdinal()
        .domain(allEventTypes)
        .range(d3.schemeSet2); // Choose a color scheme that provides at least 6 unique colors

    // Step 3: Process the data into a more usable format for stacking
    const processedData = nestedData.map(([month, counts]) => {
        const eventCounts = { month: month };
        allEventTypes.forEach(type => {
            eventCounts[type] = counts.get(type) || 0; // Fill missing event types with 0
        });
        return eventCounts;
    });

    // Step 4: Set up chart dimensions
    const width = 1000;
    const height = 500;
    const margin = { top: 20, right: 150, bottom: 100, left: 50 };

    // Clear the previous chart (if any)
    d3.select('#acled-chart').selectAll('*').remove();

    // Create an SVG container
    const svg = d3.select('#acled-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Set up scales
    const x = d3.scaleBand()
        .domain(processedData.map(d => d.month))
        .range([margin.left, width - margin.right])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d3.sum(allEventTypes, k => d[k]))])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Step 5: Create the stack generator
    const stack = d3.stack().keys(allEventTypes);
    let stackedData = stack(processedData);

    // Step 6: Draw the stacked bars
    const groups = svg.append('g')
        .selectAll('g')
        .data(stackedData, d => d.key)
        .enter()
        .append('g')
        .attr('class', d => `bar-group ${cssSafeClass(d.key)}`);

    // Add the rectangles
    groups.selectAll('rect')
        .data(d => d.map(e => ({ ...e, key: d.key })))
        .enter()
        .append('rect')
        .attr('x', d => x(d.data.month))
        .attr('y', d => y(d[1]))
        .attr('height', d => y(d[0]) - y(d[1]))
        .attr('width', x.bandwidth())
        .attr('fill', d => color(d.key)) // Apply color based on event type
        .attr('opacity', 1);

    // Add x-axis (months)
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d => d))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Add y-axis (total events)
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

    // Add y-axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', margin.left - 40)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Number of Events');

    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('Number of Events by Month and Type');

    // Step 7: Add a legend for toggling
    const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);

    allEventTypes.forEach((event_type, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`)
            .style('cursor', 'pointer')
            .on('click', () => toggleEventType(event_type));

        // Legend color box
        legendItem.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', color(event_type)) // Apply color to the legend
            .attr('class', `legend-box ${cssSafeClass(event_type)}`);

        // Legend text
        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .text(event_type)
            .style('font-size', '12px')
            .attr('alignment-baseline', 'middle');
    });

    // Step 8: Toggle event type visibility
    const activeEventTypes = new Set(allEventTypes); // Track active types
    function toggleEventType(event_type) {
        if (activeEventTypes.has(event_type)) {
            activeEventTypes.delete(event_type); // Remove type from active set
        } else {
            activeEventTypes.add(event_type); // Add type to active set
        }

        // Update legend box opacity
        d3.select(`.legend-box.${cssSafeClass(event_type)}`)
            .attr('opacity', activeEventTypes.has(event_type) ? 1 : 0.3);

        // Update the chart
        updateChart();
    }

    function updateChart() {
        // Filter the stack keys based on active event types
        const filteredKeys = Array.from(activeEventTypes);
        const newStack = d3.stack().keys(filteredKeys);
        const newStackedData = newStack(processedData);

        // Bind new data to groups
        const groupUpdate = svg.selectAll('.bar-group')
            .data(newStackedData, d => d.key);

        // Handle enter selection for new groups
        const newGroups = groupUpdate.enter().append('g')
            .attr('class', d => `bar-group ${cssSafeClass(d.key)}`);

        // Handle update selection
        newGroups.merge(groupUpdate).each(function(d) {
            const rects = d3.select(this).selectAll('rect')
                .data(d.map(e => ({ ...e, key: d.key })));

            // Enter selection
            rects.enter()
                .append('rect')
                .merge(rects) // Merge with the update selection
                .attr('x', d => x(d.data.month))
                .attr('y', d => y(d[1]))
                .attr('height', d => y(d[0]) - y(d[1]))
                .attr('width', x.bandwidth())
                .attr('fill', d => color(d.key)) // Apply color based on event type
                .attr('opacity', d => activeEventTypes.has(d.key) ? 1 : 0);

            // Exit selection
            rects.exit().remove();
        });

        // Exit selection for groups
        groupUpdate.exit().remove();
    }

    // Helper function to make class names safe for CSS (remove spaces and special characters)
    function cssSafeClass(name) {
        return name.replace(/[^a-zA-Z0-9_-]/g, '-');
    }
}
