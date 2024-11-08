let filteredData = [];

function initializeFilters(events) {
    // Get unique hosts
    const hosts = [...new Set(events.map(event => event.details["Event Host"]))].sort();
    
    // Populate host filter dropdown
    const hostSelect = document.getElementById('hostFilter');
    hostSelect.innerHTML = '<option value="all">所有主辦單位</option>';
    
    hosts.forEach(host => {
        const option = document.createElement('option');
        option.value = host;
        option.text = host;
        hostSelect.appendChild(option);
    });
    
    filteredData = events;
}

function filterEvents() {
    const selectedHost = document.getElementById('hostFilter').value;
    const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
    
    filteredData = timelineData.filter(event => {
        const hostMatch = selectedHost === 'all' || event.details["Event Host"] === selectedHost;
        const titleMatch = event.event_title.toLowerCase().includes(searchTerm);
        return hostMatch && titleMatch;
    });
    
    // Clear and redraw timeline
    createTimeline(filteredData);
}

function resetFilter() {
    document.getElementById('hostFilter').value = 'all';
    document.getElementById('searchFilter').value = '';
    filteredData = timelineData;
    createTimeline(filteredData);
}

function showEventDetails(event) {
    const detailsDiv = document.getElementById('event-details');
    const contentDiv = document.getElementById('event-details-content');
    
    // Create HTML content for details
    let content = `
        <div class="event-header">
            <h2>${event.event_title}</h2>
            ${event.thumbnail_url ? 
                `<div class="event-thumbnail">
                    <img src="${event.thumbnail_url}" alt="${event.event_title}">
                </div>` : ''
            }
        </div>
        <div class="event-info">
            <table>
                <tr>
                    <th>訂單編號</th>
                    <td>${event.order_number}</td>
                </tr>
                <tr>
                    <th>活動時間</th>
                    <td>${event.details["Start Time"]}</td>
                </tr>
                <tr>
                    <th>活動地點</th>
                    <td>${event.details["Event Location"]}</td>
                </tr>
                <tr>
                    <th>主辦單位</th>
                    <td>${event.details["Event Host"]}</td>
                </tr>
                <tr>
                    <th>票種</th>
                    <td>${event.details["Ticket Types"]}</td>
                </tr>
                <tr>
                    <th>數量</th>
                    <td>${event.details["Tickets"]}</td>
                </tr>
                <tr>
                    <th>金額</th>
                    <td>${event.details["Amount"]}</td>
                </tr>
                ${event.details["Receipt"] ? 
                    `<tr>
                        <th>發票號碼</th>
                        <td>
                            <a href="${event.details.Receipt.url}" target="_blank">
                                ${event.details.Receipt.number}
                            </a>
                        </td>
                    </tr>` : ''
                }
            </table>
            
            <div class="event-actions">
                ${event.actions.map(action => 
                    `<a href="${action.url}" 
                        class="action-button ${action.disabled ? 'disabled' : ''}" 
                        target="_blank"
                        ${action.disabled ? 'disabled' : ''}>
                        ${action.text}
                    </a>`
                ).join('')}
            </div>
        </div>
    `;
    
    contentDiv.innerHTML = content;
    detailsDiv.style.display = 'block';
}

function hideEventDetails() {
    document.getElementById('event-details').style.display = 'none';
}

// Add event labels with collision detection
function createLabels(svg, events, y) {
    const labels = svg.selectAll(".timeline-label")
        .data(events)
        .enter()
        .append("text")
        .attr("class", "timeline-label")
        .attr("x", -10)
        .attr("y", d => y(d.event_title) + y.bandwidth()/2)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .text(d => {
            // Truncate long titles
            return d.event_title.length > 30 ? 
                d.event_title.substring(0, 27) + "..." : 
                d.event_title;
        })
        .on("click", (event, d) => showEventDetails(d));

    // Add title attribute for full text on hover
    labels.append("title")
        .text(d => d.event_title);

    return labels;
}

function createTimeline(events) {
    // Clear any existing timeline first
    d3.select("#timeline").html("");
    
    const margin = {top: 30, right: 150, bottom: 50, left: 300};  // Increased right margin for tooltips
    const width = 1200 - margin.left - margin.right;
    const height = Math.max(events.length * 30, 100);  // Increased height per event

    // Parse dates
    events.forEach(d => {
        d.startDate = new Date(d.details["Start Time"].replace(/\//g, '-'));
    });

    // Sort events by date
    events.sort((a, b) => a.startDate - b.startDate);

    // Create SVG
    const svg = d3.select("#timeline")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleTime()
        .domain(d3.extent(events, d => d.startDate))
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(events.map(d => d.event_title))
        .range([0, height])
        .padding(0.3);  // Increased padding between bars

    // Add alternating background stripes
    svg.selectAll("rect.background")
        .data(events)
        .enter()
        .append("rect")
        .attr("class", "background")
        .attr("x", 0)
        .attr("y", d => y(d.event_title))
        .attr("width", width)
        .attr("height", y.bandwidth())
        .attr("fill", (d, i) => i % 2 === 0 ? "#f8f8f8" : "white");

    // Add x-axis with alternating ticks
    const xAxis = d3.axisBottom(x)
        .tickFormat(d3.timeFormat("%Y/%m/%d"));

    const xAxisGroup = svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    // Add event bars
    svg.selectAll(".timeline-bar")
        .data(events)
        .enter()
        .append("rect")
        .attr("class", "timeline-bar")
        .attr("x", d => x(d.startDate))
        .attr("y", d => y(d.event_title))
        .attr("width", 8)  // Slightly thinner bars
        .attr("height", y.bandwidth())
        .attr("rx", 4)  // Rounded corners
        .attr("ry", 4)
        .attr("fill", "#7AB80E")  // KKTIX green
        .on("mouseover", function(event, d) {
            // Highlight bar
            d3.select(this)
                .attr("fill", "#ff4444")
                .attr("width", 12);  // Make bar wider on hover
            
            // Add tooltip
            const tooltip = svg.append("g")
                .attr("class", "tooltip")
                .attr("transform", `translate(${x(d.startDate) + 15},${y(d.event_title) + y.bandwidth()/2})`);
            
            tooltip.append("rect")
                .attr("x", 0)
                .attr("y", -25)
                .attr("width", 200)
                .attr("height", 50)
                .attr("rx", 4)
                .attr("fill", "white")
                .attr("stroke", "#ccc");
                
            tooltip.append("text")
                .attr("x", 10)
                .attr("y", -5)
                .text(d.details["Start Time"]);
                
            tooltip.append("text")
                .attr("x", 10)
                .attr("y", 15)
                .text(d.details["Event Location"].substring(0, 25) + "...");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("fill", "#7AB80E")
                .attr("width", 8);
            svg.selectAll(".tooltip").remove();
        })
        .on("click", (event, d) => showEventDetails(d));

    // Replace the old label creation code with this:
    const labels = createLabels(svg, events, y);

    // Add mouseover effects for labels
    labels.on("mouseover", function() {
        d3.select(this)
            .style("fill", "#0066cc")
            .style("cursor", "pointer");
    })
    .on("mouseout", function() {
        d3.select(this)
            .style("fill", "#333");
    });
}

// Initialize the visualization when the page loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof timelineData !== 'undefined') {
        createTimeline(timelineData);
        initializeFilters(timelineData);
    }
});

