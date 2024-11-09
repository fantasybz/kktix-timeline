let filteredData = [];
const colorScale = d3.scaleOrdinal(d3.schemeSet3);  // Using D3's color scheme

function getEventColor(eventHost) {
        return colorScale(eventHost);
}

function initializeFilters(events) {
        // Get unique hosts
        const hosts = [...new Set(events.map(event => event.details["Event Host"]))].sort();

        // Get unique years from Start Time
        const years = Array.from(new Set(events.map(event => {
                const date = new Date(event.details["Start Time"].replace(/\//g, "-"));
                return date.getFullYear();
        }))).sort((a, b) => b - a);  // Sort years descending

        // Get unique locations
        const locations = [...new Set(events.map(event => event.details["Event Location"]))].sort();

        // Populate host filter dropdown
        const hostSelect = document.getElementById("hostFilter");
        hostSelect.innerHTML = "<option value=\"all\">所有主辦單位</option>";

        hosts.forEach(host => {
                const option = document.createElement("option");
                option.value = host;
                option.text = host.length > 20 ? host.substring(0, 17) + "..." : host;
                option.title = host;  // Show full text on hover
                hostSelect.appendChild(option);
        });

        // Populate year filter dropdown
        const yearSelect = document.getElementById("yearFilter");
        yearSelect.innerHTML = "<option value='all'>所有年份</option>";

        years.forEach(year => {
                const option = document.createElement("option");
                option.value = year;
                option.text = year;
                yearSelect.appendChild(option);
        });

        // Populate location filter dropdown
        const locationSelect = document.getElementById("locationFilter");
        locationSelect.innerHTML = "<option value='all'>所有地點</option>";

        locations.forEach(location => {
                const option = document.createElement("option");
                option.value = location;
                option.text = location.length > 20 ? location.substring(0, 17) + "..." : location;
                option.title = location;  // Show full text on hover
                locationSelect.appendChild(option);
        });

        filteredData = events;
}

function filterEvents() {
        const selectedHost = document.getElementById("hostFilter").value;
        const selectedYear = document.getElementById("yearFilter").value;
        const selectedLocation = document.getElementById("locationFilter").value;
        const searchTerm = document.getElementById("searchFilter").value.toLowerCase();

        filteredData = timelineData.filter(event => {
                const hostMatch = selectedHost === "all" || event.details["Event Host"] === selectedHost;
                const titleMatch = event.event_title.toLowerCase().includes(searchTerm);
                const locationMatch = selectedLocation === "all" || event.details["Event Location"] === selectedLocation;  // Year matching
                const eventDate = new Date(event.details["Start Time"].replace(/\//g, "-"));
                const yearMatch = selectedYear === "all" || eventDate.getFullYear().toString() === selectedYear;
                return hostMatch && titleMatch && yearMatch && locationMatch;
        });

        // Sort filtered data before creating timeline
        filteredData.sort((a, b) => {
                const aDate = new Date(a.details["Start Time"].replace(/\//g, "-"));
                const bDate = new Date(b.details["Start Time"].replace(/\//g, "-"));
                return bDate - aDate;  // Descending order
        });

        // Clear and redraw timeline
        createTimeline(filteredData);
}

function resetFilter() {
        document.getElementById("hostFilter").value = "all";
        document.getElementById("searchFilter").value = "";
        filteredData = timelineData;
        createTimeline(filteredData);
}

function showEventDetails(event) {
        const detailsDiv = document.getElementById("event-details");
        const contentDiv = document.getElementById("event-details-content");

        // Create HTML content for details
        let content = `
        <div class="event-header">
            <h2>${event.event_title}</h2>
            ${event.thumbnail_url ? `<div class="event-thumbnail"><img src="${event.thumbnail_url}" alt="${event.event_title}"></div>` : ""}
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
                    </tr>` : ""
                }
            </table>
            
            <div class="event-actions">
                ${event.actions.map(action =>
                        `<a href="${action.url}" 
                        class="action-button ${action.disabled ? "disabled" : ""}" 
                        target="_blank"
                        ${action.disabled ? "disabled" : ""}>
                        ${action.text}
                    </a>`
                ).join("")}
            </div>
        </div>
    `;

        contentDiv.innerHTML = content;
        detailsDiv.style.display = "block";
}

function hideEventDetails() {
        document.getElementById("event-details").style.display = "none";
}

// Add event labels with collision detection
function createLabels(svg, events, y) {
        // Calculate available width for labels based on margin
        const labelMaxWidth = 280;

        const labels = svg.selectAll(".timeline-label")
                .data(events)
                .enter()
                .append("text")
                .attr("class", "timeline-label")
                .attr("x", -10)
                .attr("y", d => y(d.event_title) + y.bandwidth() / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "end")
                .each(function (d) {
                        const self = d3.select(this);
                        const truncated = d.event_title.length > 30
                                ? d.event_title.substring(0, 30) + "..."
                                : d.event_title;
                        self.text(truncated);
                })
                .on("click", (event, d) => showEventDetails(d));

        // Add title attribute for full text on hover
        labels.append("title")
                .text(d => d.event_title);

        return labels;
}

function updateSummary(events) {
        // Calculate total amount with safety checks
        const total = events.reduce((sum, event) => {
                const amountStr = event.details["Amount"] || "0";
                const amount = parseInt(amountStr.replace(/[^0-9-]/g, "")) || 0;
                return sum + amount;
        }, 0);

        // Calculate total learning hours from Event Time
        const totalHours = events.reduce((sum, event) => {
                const eventTime = event.details["Event Time"];
                if (!eventTime) return sum;

                try {
                        // Check if it"s a time range (contains "~")
                        if (eventTime.includes("~")) {
                                const [startStr, endStr] = eventTime.split("~").map(t => t.trim());
                                const start = new Date(startStr.split("(")[0].trim());
                                const end = new Date(endStr.split("(")[0].trim());
                                const diffInHours = (end - start) / (1000 * 60 * 60);
                                return sum + (isNaN(diffInHours) ? 0 : diffInHours);
                        } else {
                                // If no end time, assume 0 hours
                                return sum;
                        }
                } catch (e) {
                        console.warn("Error parsing event time:", eventTime);
                        return sum;
                }
        }, 0);

        // Update summary stats with safety checks
        const totalAmountElement = document.getElementById("totalAmount");
        const totalEventsElement = document.getElementById("totalEvents");
        const totalHoursElement = document.getElementById("totalHours");

        if (totalAmountElement) {
                totalAmountElement.textContent = `NT$ ${total.toLocaleString()}`;
        }
        if (totalEventsElement) {
                totalEventsElement.textContent = events.length;
        }
        if (totalHoursElement) {
                totalHoursElement.textContent = `${totalHours.toFixed(1)} 小時`;
        }

        // Create charts
        createExpenseChart(events);
        createLocationChart(events);
}

function createExpenseChart(events) {
        // Clear existing chart
        d3.select("#expenseChart").html("");

        // Process and sort events by amount
        const sortedEvents = events
                .map(event => {
                        // Extract numbers from amount string and handle invalid cases
                        const amountStr = event.details["Amount"] || "0";
                        const amount = parseInt(amountStr.replace(/[^0-9-]/g, "")) || 0;
                        return {
                                title: event.event_title,
                                amount: amount
                        };
                })
                .filter(event => event.amount > 0) // Only include positive amounts
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);

        // Get container dimensions
        const container = document.getElementById("expenseChart");
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Set up dimensions
        const margin = { top: 20, right: 20, bottom: 60, left: 80 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select("#expenseChart")
                .append("svg")
                .attr("width", containerWidth)
                .attr("height", containerHeight)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

        // Set up scales
        const x = d3.scaleBand()
                .range([0, width])
                .padding(0.3)
                .domain(sortedEvents.map(d => d.title));

        const y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(sortedEvents, d => d.amount)]);

        // Add bars
        svg.selectAll(".expense-bar")
                .data(sortedEvents)
                .enter()
                .append("rect")
                .attr("class", "expense-bar")
                .attr("x", d => x(d.title))
                .attr("y", d => y(d.amount))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y(d.amount))
                .append("title")
                .text(d => `${d.title}\nNT$ ${d.amount.toLocaleString()}`);

        // Add axes with horizontal labels
        svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .style("text-anchor", "middle")
                .attr("dx", "0")
                .attr("dy", "1em")
                .attr("transform", "rotate(0)")
                .text(function (d) {
                        return d.length > 10 ? d.substring(0, 10) + "..." : d;
                });

        svg.append("g")
                .call(d3.axisLeft(y)
                        .ticks(5)
                        .tickFormat(d => `NT$ ${d.toLocaleString()}`));
}

function createTimeline(events) {
        updateSummary(events);
        d3.select("#timeline").html("");

        // Calculate width based on window size
        const containerWidth = Math.min(window.innerWidth * 0.95, 1600);
        const margin = { top: 50, right: 50, bottom: 100, left: 300 };
        const width = containerWidth - margin.left - margin.right;

        // Calculate height based on number of events with a minimum row height
        const rowHeight = 30;
        const height = Math.max(events.length * rowHeight, 100);

        // Create a container div with fixed height and scrolling if needed
        const container = d3.select("#timeline")
                .style("height", "600px")
                .style("overflow-y", "auto")
                .style("padding-bottom", "100px");

        // Create SVG with extra padding at bottom
        const svg = container.append("svg")
                .attr("width", containerWidth)
                .attr("height", height + margin.top + margin.bottom + 100)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

        // Parse both start and end dates
        events.forEach(d => {
                d.startDate = new Date(d.details["Start Time"].replace(/\//g, "-"));
                d.endDate = d.details["End Time"] ?
                        new Date(d.details["End Time"].replace(/\//g, "-")) :
                        d.startDate;  // Use start date if no end date
        });

        // Sort events by start time in descending order
        events.sort((a, b) => b.startDate - a.startDate);

        // Set up scales - extend domain to include end dates with buffer
        const x = d3.scaleTime()
                .domain([
                        d3.min(events, d => d.startDate),
                        d3.max(events, d => d.endDate)
                ])
                .nice();  // Round to nice values first

        // Calculate buffer based on the domain range
        const timeRange = x.domain()[1] - x.domain()[0];
        const bufferDays = Math.ceil(timeRange / (1000 * 60 * 60 * 24 * 30)); // Roughly one day per month of range

        x.domain([
                d3.timeDay.offset(x.domain()[0], -bufferDays),  // Dynamic buffer at start
                d3.timeDay.offset(x.domain()[1], bufferDays)    // Dynamic buffer at end
        ])
                .range([0, width]);

        const y = d3.scaleBand()
                .domain(events.map(d => d.event_title))
                .range([0, height])
                .padding(0.3);

        // Add alternating background stripes
        svg.selectAll("rect.background")
                .data(events)
                .enter()
                .append("rect")
                .attr("class", "background")
                .attr("x", -margin.left)
                .attr("y", d => y(d.event_title))
                .attr("width", width + margin.left + margin.right)
                .attr("height", y.bandwidth())
                .attr("fill", "white")
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");

        // Add hover effect for rows
        svg.selectAll(".background")
                .on("mouseover", function () {
                        d3.select(this)
                                .attr("fill", "#edf3ff")
                                .attr("stroke", "#ccd9ff");
                })
                .on("mouseout", function () {
                        d3.select(this)
                                .attr("fill", "white")
                                .attr("stroke", "#e0e0e0");
                });

        const xAxisBottom = d3.axisBottom(x)
                .tickFormat(d3.timeFormat("%Y/%m/%d"));

        const xAxisTop = d3.axisTop(x)
                .tickFormat(d3.timeFormat("%Y/%m/%d"));

        // Add bottom axis
        svg.append("g")
                .attr("class", "x-axis bottom")
                .attr("transform", `translate(0,${height})`)
                .call(xAxisBottom);

        // Add top axis
        svg.append("g")
                .attr("class", "x-axis top")
                .call(xAxisTop);

        // Update event bars to show duration
        svg.selectAll(".timeline-bar")
                .data(events)
                .enter()
                .append("rect")
                .attr("class", "timeline-bar")
                .attr("x", d => x(d.startDate))
                .attr("y", d => y(d.event_title))
                .attr("width", d => {
                    // Calculate the difference in days
                    const oneDayInMs = 24 * 60 * 60 * 1000;
                    const duration = d.endDate - d.startDate;
                    const days = Math.max(1, duration / oneDayInMs); // At least 1 day
                    return Math.max(20, x(d.startDate.getTime() + (days * oneDayInMs)) - x(d.startDate));
                })
                .attr("height", y.bandwidth())
                .attr("rx", 4)
                .attr("ry", 4)
                .attr("fill", d => getEventColor(d.details["Event Host"]))  // Color by host
                .style("transition", "fill 0.3s ease")
                .on("mouseover", function (event, d) {
                        // Darken the same color on hover
                        d3.select(this)
                                .attr("fill", d3.color(getEventColor(d.details["Event Host"])).darker(0.5))
                                .style("cursor", "pointer");

                        // Calculate max width based on text lengths
                        const startTime = d.details["Start Time"] || ""
                        const eventTime = d.details["Event Time"] || "";
                        const [_startTime, endTime] = eventTime.split(" ~ ");
                        const startText = `開始: ${startTime || "N/A"}`;
                        const endText = endTime ? `結束: ${endTime}` : "";
                        const locationText = d.details["Event Location"].substring(0, 20) + "...";
                        
                        const maxWidth = Math.max(
                            startText.length * 8,  // Approximate width per character
                            endText.length * 8,
                            locationText.length * 8
                        );

                        // Calculate tooltip position
                        const barX = x(d.startDate) + 40;
                        const barY = y(d.event_title);
                        const svgWidth = width + margin.left + margin.right;
                        
                        // Determine if tooltip should go above/below and left/right of the bar
                        const tooltipHeight = endTime ? 70 : 55;
                        const tooltipWidth = maxWidth + 50;
                        
                        // Default position (to the right and centered vertically)
                        let tooltipX = barX;
                        let tooltipY = barY + y.bandwidth() / 2;
                        
                        // Adjust horizontal position if too close to right edge
                        if (tooltipX + tooltipWidth > svgWidth) {
                            tooltipX = x(d.startDate) - tooltipWidth - 15;
                        }
                        
                        // Adjust vertical position if too close to top or bottom
                        if (tooltipY - tooltipHeight/2 < 0) {
                            tooltipY = tooltipHeight/2;
                        } else if (tooltipY + tooltipHeight/2 > height) {
                            tooltipY = height - tooltipHeight/2;
                        }

                        // Add tooltip with adjusted position
                        const tooltip = svg.append("g")
                            .attr("class", "tooltip")
                            .attr("transform", `translate(${tooltipX},${tooltipY})`);

                        // Create the tooltip background
                        tooltip.append("rect")
                            .attr("x", 0)
                            .attr("y", -tooltipHeight/2)
                            .attr("width", tooltipWidth)
                            .attr("height", tooltipHeight)
                            .attr("rx", 4)
                            .attr("fill", "white")
                            .attr("stroke", "#ccc");

                        // Add text elements with adjusted positions
                        tooltip.append("text")
                            .attr("x", 10)
                            .attr("y", -15)
                            .text(startText);

                        if (endTime) {
                            tooltip.append("text")
                                .attr("x", 10)
                                .attr("y", 5)
                                .text(endText);
                        }

                        tooltip.append("text")
                            .attr("x", 10)
                            .attr("y", endTime ? 25 : 5)
                            .text(locationText);
                })
                .on("mouseout", function (event, d) {
                        // Return to original color
                        d3.select(this)
                                .attr("fill", getEventColor(d.details["Event Host"]))
                                .style("cursor", "default");
                        svg.selectAll(".tooltip").remove();
                })
                .on("click", (event, d) => showEventDetails(d));

        // Replace the old label creation code with this:
        const labels = createLabels(svg, events, y);

        // Add mouseover effects for labels
        labels.on("mouseover", function () {
                d3.select(this)
                        .style("fill", "#0066cc")
                        .style("cursor", "pointer");
        })
                .on("mouseout", function () {
                        d3.select(this)
                                .style("fill", "#333");
                });
}

// Add window resize handler
window.addEventListener("resize", () => {
        if (filteredData.length > 0) {
                createTimeline(filteredData);
        }
});

// Initialize the visualization when the page loads
document.addEventListener("DOMContentLoaded", function () {
        if (typeof timelineData !== "undefined") {
                createTimeline(timelineData);
                initializeFilters(timelineData);
        }
});

// Add new function for location chart
function createLocationChart(events) {
        // Clear existing chart
        d3.select("#locationChart").html("");

        // Group events by location and count occurrences, excluding "Unknown"
        const locationCounts = events.reduce((acc, event) => {
                const location = event.details["Event Location"];
                if (location && location !== "Unknown") {  // Only count if location exists and isn"t "Unknown"
                        acc[location] = (acc[location] || 0) + 1;
                }
                return acc;
        }, {});

        // Convert to array and sort by count
        const sortedLocations = Object.entries(locationCounts)
                .map(([location, count]) => ({ location, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 locations

        // Set up dimensions
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const width = document.querySelector(".graph-box").clientWidth - margin.left - margin.right;
        const height = 180 - margin.top - margin.bottom;

        // Create scales
        const x = d3.scaleBand()
                .range([0, width])
                .padding(0.1)
                .domain(sortedLocations.map(d => d.location));

        const y = d3.scaleLinear()
                .range([height, 0])
                .domain([0, d3.max(sortedLocations, d => d.count)]);

        // Create SVG
        const svg = d3.select("#locationChart")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

        // Add bars
        svg.selectAll(".location-bar")
                .data(sortedLocations)
                .enter()
                .append("rect")
                .attr("class", "location-bar")
                .attr("x", d => x(d.location))
                .attr("width", x.bandwidth())
                .attr("y", d => y(d.count))
                .attr("height", d => height - y(d.count));

        // Add axes with horizontal labels
        svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .style("text-anchor", "middle")
                .attr("dx", "0")
                .attr("dy", "1em")
                .attr("transform", "rotate(0)")
                .text(function (d) {
                        return d.length > 10 ? d.substring(0, 10) + "..." : d;
                });

        svg.append("g")
                .call(d3.axisLeft(y)
                        .ticks(5)
                        .tickFormat(d3.format("d"))); // Use integer format

        // Add value labels on top of bars
        svg.selectAll(".value-label")
                .data(sortedLocations)
                .enter()
                .append("text")
                .attr("class", "value-label")
                .attr("x", d => x(d.location) + x.bandwidth() / 2)
                .attr("y", d => y(d.count) - 5)
                .attr("text-anchor", "middle")
                .text(d => d.count);
}

