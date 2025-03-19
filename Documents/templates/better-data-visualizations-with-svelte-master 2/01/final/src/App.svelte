<script>
  import { onMount } from 'svelte';
  import Papa from 'papaparse';
  import Scatterplot from './components/Scatterplot.svelte';

  let data = [];
  let columns = [];
  let domainColumn = "";
  let uniqueValues = [];
  let selectedValues = new Set();
  let opacity = 1;

  let startDate, endDate, filteredData = [];
  let allDates = [];
  let currentScrubIndex = 0;
  let animationInterval = null;

  onMount(async () => {
    const response = await fetch('/Georgia Data.csv');
    const csvText = await response.text();
    parseCSV(csvText);
  });

  function parseCSV(csvText) {
    const result = Papa.parse(csvText, { header: true });
    data = result.data
      .filter(d => d.x && d.y && d.date)
      .map(d => ({ ...d, x: +d.x, y: +d.y, date: new Date(d.date) }));

    columns = result.meta.fields || [];

    allDates = Array.from(new Set(data.map(d => d.date.getTime())))
      .sort((a, b) => a - b)
      .map(t => new Date(t));

    startDate = allDates[0];
    endDate = allDates[allDates.length - 1];
    currentScrubIndex = 0;
  }

  $: currentScrubDate = allDates[currentScrubIndex] || startDate;

  $: filteredData = data.filter(
    d => d.date >= startDate && d.date <= currentScrubDate
  );

  function handleDomainChange(event) {
    domainColumn = event.target.value;
    if (domainColumn) {
      uniqueValues = [...new Set(data.map(d => d[domainColumn]).filter(Boolean))];
      selectedValues = new Set(uniqueValues);
    }
  }

  function handleSelectionChange(event) {
    selectedValues = new Set(Array.from(event.target.selectedOptions, o => o.value));
  }

  function handleStartDateChange(e) {
    startDate = new Date(e.target.value);
    if (startDate > currentScrubDate) {
      currentScrubIndex = allDates.findIndex(d => d >= startDate);
    }
  }

  function handleEndDateChange(e) {
    endDate = new Date(e.target.value);
    if (endDate < currentScrubDate) {
      currentScrubIndex = allDates.findIndex(d => d <= endDate);
    }
  }

  function playAnimation() {
    clearInterval(animationInterval);
    currentScrubIndex = allDates.findIndex(d => d >= startDate);

    animationInterval = setInterval(() => {
      if (currentScrubIndex >= allDates.length || allDates[currentScrubIndex] > endDate) {
        clearInterval(animationInterval);
        return;
      }
      currentScrubIndex += 1;
    }, 500);
  }

  function pauseAnimation() {
    clearInterval(animationInterval);
  }

  function formatDateInput(date) {
    return date ? date.toISOString().split('T')[0] : '';
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        parseCSV(e.target.result);
      };
      reader.readAsText(file);
    }
  }
</script>

<div class="container">
  <div class="filter-column">
    <label>Upload CSV File:</label>
    <input type="file" accept=".csv" on:change={handleFileUpload} />

    {#if columns.length}
      <label>Select a column for coloring:</label>
      <select on:change={handleDomainChange} bind:value={domainColumn}>
        <option value="" disabled selected>Select column</option>
        {#each columns as column}
          <option value={column}>{column}</option>
        {/each}
      </select>
    {/if}

    {#if uniqueValues.length}
      <label>Select values to highlight:</label>
      <select multiple size="5" class="multi-select" on:change={handleSelectionChange}>
        {#each uniqueValues as value}
          <option value={value} selected>{value}</option>
        {/each}
      </select>
    {/if}

    <label>Adjust Opacity:</label>
    <input type="range" min="0.01" max="1" step="0.1" bind:value={opacity} />

    <div class="date-controls">
      <label>Start Date:</label>
      <input type="date" value={formatDateInput(startDate)} on:change={handleStartDateChange} />
      <br/>
      <label>End Date:</label>
      <input type="date" value={formatDateInput(endDate)} on:change={handleEndDateChange} />

      <label>Date Scrubber:</label>
      <input type="range" min="0" max={allDates.length - 1} bind:value={currentScrubIndex} />
      <div class="current-date">{formatDateInput(currentScrubDate)}</div>

      <div class="buttons">
        <button on:click={playAnimation}>▶️ Play</button>
        <button on:click={pauseAnimation}>⏸️ Pause</button>
      </div>
    </div>
  </div>

  <div class="scatterplot-container">
    {#if filteredData.length}
      <Scatterplot data={filteredData} {domainColumn} {selectedValues} {opacity} />
    {:else}
      <p>Loading data...</p>
    {/if}
  </div>
</div>

<style>
  .container {
    display: flex;
    gap: 1rem;
    padding: 1rem;
  }
  .filter-column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    border: 1px solid #ddd;
    border-radius: 10px;
    background-color: #fafafa;
    width: 280px;
  }
  .filter-column label {
    font-weight: bold;
  }
  .multi-select option {
    padding: 6px;
  }
  .scatterplot-container {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .current-date {
    font-size: 0.9rem;
    margin-top: 5px;
  }
  .buttons {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }
</style>
