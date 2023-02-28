function parseCsvFile(text) {
  // Read in the CSV files
  const rows = text.trim().split("\n");
  const timestamp = +rows[0];
  const rate = +rows[1];
  const samples = rows.slice(2).map((d) => +d);
  return { timestamp, rate, samples };
}

const dropZone = document.getElementById("dropzone");

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();

  const files = event.dataTransfer.files;
  const fileReaders = [];

  for (let i = 0; i < files.length; i++) {
    const fileReader = new FileReader();
    const promise = new Promise((resolve, reject) => {
      fileReader.onload = (event) => {
        const parsedData = parseCsvFile(event.target.result);
        resolve(parsedData);
      };
      fileReader.onerror = (event) => {
        reject(event);
      };
    });
    fileReader.readAsText(files[i]);
    fileReaders.push(promise);
  }

  const parsedFiles = await Promise.all(fileReaders);

  // Parse the Unix timestamps and rates
  const timestamps = parsedFiles.map((file) => new Date(file.timestamp * 1000));
  const sampleRate = parsedFiles[0].rate;

  // Determine the earliest start time
  const latestTime = new Date(Math.max(...timestamps));

  // Calculate the offsets
  const offsets = timestamps.map((time) =>
    Math.round(((latestTime - time) / 1000) * sampleRate)
  );
  const startTimes = parsedFiles.map(
    (file, i) => new Date((file.timestamp + offsets[i] / sampleRate) * 1000)
  );

  // Synchronize the data and remove the earliest samples
  const syncedFiles = parsedFiles.map((file, i) => {
    const syncedSamples = file.samples.slice(offsets[i]);
    const startTime = startTimes[i];
    const endTime = new Date(
      startTime.getTime() + (syncedSamples.length / sampleRate) * 1000
    );
    return { startTime, endTime, sampleRate, samples: syncedSamples };
  });

  const normalizedFiles = syncedFiles.map((file) => {
    // const min = d3.quantile(file.samples, 0.01);
    // const max = d3.quantile(file.samples, 0.99);
    const min = d3.min(file.samples);
    const max = d3.max(file.samples);
    const normalizedSamples = file.samples.map((d) =>
      d3.scaleLinear([min, max], [-1, 1])(d)
    );
    return { ...file, samples: normalizedSamples };
  });

  console.log(normalizedFiles);

  // Hide dropzone
  document.querySelector(".dropzone-wrapper").style.display = "none";

  plotData(normalizedFiles);
});

function plotData(syncedFiles) {
  // Set the dimensions and margins of the plot area
  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  // Set the x and y scales
  const startTime = syncedFiles[0].startTime;
  const endTime = syncedFiles[0].endTime;
  const sampleRate = syncedFiles[0].sampleRate;
  const startScale = d3
    .scaleTime()
    .domain([startTime, endTime])
    .range([0, width]);

  const xScale = d3.scaleTime().domain([startTime, endTime]).range([0, width]);
  const yScale = d3.scaleLinear().domain([-1, 1]).range([height, 0]);
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Create the line function
  const line = d3
    .line()
    .x((d, i) =>
      xScale(new Date(startTime.getTime() + (i * 1000) / sampleRate))
    )
    .y((d) => yScale(d));

  // Create the SVG element
  const svg = d3
    .select("#plot")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("overflow", "visible")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const clip = svg
    .append("defs")
    .append("svg:clipPath")
    .attr("id", "clip")
    .append("svg:rect")
    .attr("width", width)
    .attr("height", height)
    .attr("x", 0)
    .attr("y", 0);

  const graph = svg.append("g").attr("clip-path", "url(#clip)");

  // Append a path element for each file's data
  syncedFiles.forEach((data, i) => {
    graph
      .append("path")
      .datum(data.samples)
      .attr("fill", "none")
      .attr("stroke", colorScale(i))
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.5)
      .attr("d", line);
  });

  // Add the x axis
  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(xScale));

  // Add the y axis
  svg.append("g").call(d3.axisLeft(yScale));

  // Add brushing
  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [width, 20],
    ])
    .on("brush", brushed);

  // Set the initial brush extent to cover the entire x-axis domain
  const initialBrushExtent = [startTime, endTime];
  brush.move(svg.select(".brush"), initialBrushExtent.map(xScale));

  svg
    .append("g")
    .attr("class", "brush")
    .attr("transform", `translate(0, ${height + 20})`)
    .call(brush)
    .call(brush.move, initialBrushExtent.map(xScale));
  // .selectAll("rect")
  // .attr("y", height)
  // .attr("height", margin.bottom - 1);
  // .call(brush.move, [0, width]);

  function brushed(event) {
    const extent = event.selection;

    let x0, x1;
    if (!extent) {
      [x0, x1] = [startTime, endTime]; // xScale.domain([startTime, endTime]);
    } else {
      [x0, x1] = extent.map(startScale.invert);
    }
    const newScale = xScale.domain([x0, x1]);
    // xAxis
    //   .transition()
    //   .duration(300)
    //   .call(d3.axisBottom(xScale).scale(xScale.domain([x0, x1])));
    // xScale.domain([ x.invert(extent[0]), x.invert(extent[1]) ])
    svg
      .selectAll("path")
      .datum((d) => d || 0)
      .attr(
        "d",
        line.x((d, i) =>
          newScale(new Date(startTime.getTime() + (i * 1000) / sampleRate))
        )
      );

    // if (event.selection) {
    //   const [x0, x1] = event.selection.map(xScale.invert);
    //   xAxis.call(d3.axisBottom(xScale).scale(xScale.domain([x0, x1])));
    // }
  }
}
