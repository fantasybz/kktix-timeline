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
		const date = new Date(event.details["Start Time"].replace(/\//g, '-'));
		return date.getFullYear();
	}))).sort((a, b) => b - a);  // Sort years descending

	// Get unique locations
	const locations = [...new Set(events.map(event => event.details["Event Location"]))].sort();

	// Populate host filter dropdown
	const hostSelect = document.getElementById('hostFilter');
	hostSelect.innerHTML = '<option value="all">所有主辦單位</option>';

	hosts.forEach(host => {
		const option = document.createElement('option');
		option.value = host;
		option.text = host.length > 20 ? host.substring(0, 17) + '...' : host;
		option.title = host;  // Show full text on hover
		hostSelect.appendChild(option);
	});

	// Populate year filter dropdown
	const yearSelect = document.getElementById('yearFilter');
	yearSelect.innerHTML = '<option value="all">所有年份</option>';

	years.forEach(year => {
		const option = document.createElement('option');
		option.value = year;
		option.text = year;
		yearSelect.appendChild(option);
	});

	// Populate location filter dropdown
	const locationSelect = document.getElementById('locationFilter');
	locationSelect.innerHTML = '<option value="all">所有地點</option>';

	locations.forEach(location => {
		const option = document.createElement('option');
		option.value = location;
		option.text = location.length > 20 ? location.substring(0, 17) + '...' : location;
		option.title = location;  // Show full text on hover
		locationSelect.appendChild(option);
	});

	filteredData = events;
}

function filterEvents() {
	const selectedHost = document.getElementById('hostFilter').value;
	const selectedYear = document.getElementById('yearFilter').value;
	const selectedLocation = document.getElementById('locationFilter').value;
	const searchTerm = document.getElementById('searchFilter').value.toLowerCase();

	filteredData = timelineData.filter(event => {
		const hostMatch = selectedHost === 'all' || event.details["Event Host"] === selectedHost;
		const titleMatch = event.event_title.toLowerCase().includes(searchTerm);
		const locationMatch = selectedLocation === 'all' || event.details["Event Location"] === selectedLocation;
		
		// Year matching
		const eventDate = new Date(event.details["Start Time"].replace(/\//g, '-'));
		const yearMatch = selectedYear === 'all' || eventDate.getFullYear().toString() === selectedYear;
		
		return hostMatch && titleMatch && yearMatch && locationMatch;
	});

	// Sort filtered data before creating timeline
	filteredData.sort((a, b) => {
		const aDate = new Date(a.details["Start Time"].replace(/\//g, '-'));
		const bDate = new Date(b.details["Start Time"].replace(/\//g, '-'));
		return bDate - aDate;  // Descending order
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
		.attr("y", d => y(d.event_title) + y.bandwidth() / 2)
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

	// Calculate width based on window size
	const containerWidth = Math.min(window.innerWidth * 0.95, 1600); // 95% of window width, max 1600px
	const margin = { top: 30, right: 150, bottom: 50, left: 300 };
	const width = containerWidth - margin.left - margin.right;
	const height = Math.max(events.length * 30, 100);


	// Parse both start and end dates
	events.forEach(d => {
		d.startDate = new Date(d.details["Start Time"].replace(/\//g, '-'));
		d.endDate = d.details["End Time"] ?
			new Date(d.details["End Time"].replace(/\//g, '-')) :
			d.startDate;  // Use start date if no end date
	});

	// Sort events by start time in descending order
	events.sort((a, b) => b.startDate - a.startDate);

	// Create SVG and scales
	const svg = d3.select("#timeline")
		.append("svg")
		.attr("width", containerWidth)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);

	// Set up scales - extend domain to include end dates
	const x = d3.scaleTime()
		.domain([
			d3.min(events, d => d.startDate),
			d3.max(events, d => d.endDate)
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

	// Update event bars to show duration
	svg.selectAll(".timeline-bar")
		.data(events)
		.enter()
		.append("rect")
		.attr("class", "timeline-bar")
		.attr("x", d => x(d.startDate))
		.attr("y", d => y(d.event_title))
		.attr("width", d => Math.max(8, x(d.endDate) - x(d.startDate)))
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

			// Add tooltip with both start and end times
			const tooltip = svg.append("g")
				.attr("class", "tooltip")
				.attr("transform", `translate(${x(d.startDate) + 15},${y(d.event_title) + y.bandwidth() / 2})`);

			tooltip.append("rect")
				.attr("x", 0)
				.attr("y", -35)  // Adjusted for two lines
				.attr("width", 200)
				.attr("height", 70)  // Increased height
				.attr("rx", 4)
				.attr("fill", "white")
				.attr("stroke", "#ccc");

			tooltip.append("text")
				.attr("x", 10)
				.attr("y", -15)
				.text(`開始: ${d.details["Start Time"]}`);

			tooltip.append("text")
				.attr("x", 10)
				.attr("y", 5)
				.text(`結束: ${d.details["End Time"] || "N/A"}`);

			tooltip.append("text")
				.attr("x", 10)
				.attr("y", 25)
				.text(d.details["Event Location"].substring(0, 25) + "...");
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
window.addEventListener('resize', () => {
	if (filteredData.length > 0) {
		createTimeline(filteredData);
	}
});

// Initialize the visualization when the page loads
document.addEventListener('DOMContentLoaded', function () {
	if (typeof timelineData !== 'undefined') {
		createTimeline(timelineData);
		initializeFilters(timelineData);
	}
});

