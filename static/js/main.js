// Fetch the ACLED data from the JSON file
d3.json('data/acled_data.json').then(data => {
    // Call the function to create the chart with the fetched data
    createAcledChart(data);
}).catch(error => {
    console.error('Error fetching ACLED data:', error);
});

function createAcledChart(data) {
    // Aggregate data to get count per event type
    const eventCounts = d3.rollup(data, v => v.length, d => d.event_type);
    const processedData = Array.from(eventCounts, ([event_type, count]) => ({ event_type, count }));

    // Set up chart dimensions
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    // Create an SVG container
    const svg = d3.select('#acled-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Set up scales
    const x = d3.scaleBand()
        .domain(processedData.map(d => d.event_type))
        .range([margin.left, width - margin.right])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.count)])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Create bars for the chart
    svg.append('g')
        .selectAll('rect')
        .data(processedData)
        .enter()
        .append('rect')
        .attr('x', d => x(d.event_type))
        .attr('y', d => y(d.count))
        .attr('height', d => y(0) - y(d.count))
        .attr('width', x.bandwidth())
        .attr('fill', 'steelblue');

    // Add x-axis
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Add y-axis
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
        .text('ACLED Events by Type');
}
