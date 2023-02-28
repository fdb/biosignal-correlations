// Example CSV data for three files
const file1 = `1674731097.00\n64.000000\n-0.00\n-0.00\n-0.00\n-0.00\n-0.00\n-0.00\n-0.00\n-0.00\n-0.00\n-0.00\n0.00\n0.01\n0.01\n-0.00\n-0.03\n-0.05\n-0.05\n0.00\n0.13\n0.36\n0.66\n`;
const file2 = `1674731098.00\n64.000000\n0.36\n0.33\n0.29\n0.24\n0.18\n0.12\n0.06\n0.01\n-0.04\n-0.09\n-0.14\n-0.18\n-0.23\n-0.26\n-0.29\n-0.30\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n`;
const file3 = `1674731099.00\n64.000000\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n-0.31\n`;

// Read in the CSV files
const files = [file1, file2, file3];
const parsedFiles = files.map((file) => {
  const rows = file.trim().split("\n");
  const timestamp = +rows[0];
  const rate = +rows[1];
  const samples = rows.slice(2).map((d) => +d);
  return { timestamp, rate, samples };
});

// Parse the Unix timestamps
const timestamps = parsedFiles.map((file) => new Date(file.timestamp * 1000));

// Determine the earliest start time
const earliestTime = new Date(Math.min(...timestamps));

// Calculate the offsets
const offsets = timestamps.map((time) =>
  Math.round(((time - earliestTime) / 1000) * parsedFiles[0].rate)
);

// Synchronize the data and remove the earliest samples
const syncedFiles = parsedFiles.map((file, i) => {
  const syncedSamples = file.samples.slice(offsets[i]);
  const cutoff = Math.ceil(offsets[i] / parsedFiles[0].rate); // Calculate the number of earliest samples to cut off
  return syncedSamples.slice(cutoff);
});

console.log(syncedFiles); // Output: [[-0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, 0.0, 0.01, 0.01, -0, -0.03, -0.05, -0.05, 0, 0.13, 0.36, 0.66], [0.33, 0.29, 0.24
