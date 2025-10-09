<script>
  import { onMount } from 'svelte';

  let data = [];
  let filteredData = [];
  let loading = true;
  let error = null;

  const today = new Date();
  const todayStr = today.getFullYear() + '-' +
                   String(today.getMonth() + 1).padStart(2, '0') + '-' +
                   String(today.getDate()).padStart(2, '0');

  // Filters
  let dateFilter = todayStr;
  let collectionFilter = '';
  let uniqueCollections = [];

  // Sorting
  let sortColumn = 'added_on';
  let sortDirection = 'desc';

  // View mode
  let viewMode = 'table'; // 'table' or 'grouped'
  let groupedData = {};

  // Feedback tracking
  let feedback = {}; // key: url+match_poll_id, value: 'correct' or 'incorrect'

  // Define column order (collections at the end)
  let columnOrder = [];

  function normalizeCollectionLabel(c) {
    if (c == null) return '';
    return c.toString()
      .replace(/^[\s'"\[\]]+|[\s'"\[\]]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractCollections(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(normalizeCollectionLabel).filter(Boolean);

    if (typeof val === 'string') {
      const s = val.trim();
      if (s.startsWith('[') && s.endsWith(']')) {
        try {
          const arr = JSON.parse(s);
          if (Array.isArray(arr)) return arr.map(normalizeCollectionLabel).filter(Boolean);
        } catch {}
      }
      const pieces = s.includes(',') || s.includes('|') ? s.split(/[,\|]+/) : [s];
      return pieces.map(normalizeCollectionLabel).filter(Boolean);
    }
    return [];
  }

  function coercePoll(p) {
    // Accept objects, arrays-with-one-object, or JSON strings
    if (!p) return null;
    let obj = p;
    if (typeof p === 'string') {
      try { obj = JSON.parse(p); } catch { return null; }
    }
    if (Array.isArray(obj)) obj = obj[0] ?? null;
    if (obj && typeof obj === 'object') return obj;
    return null;
  }

  function getSample(p) {
    return p?.sample_size ?? p?.sample ?? 'N/A';
  }

  function handleFeedback(item, isCorrect) {
    const key = `${item.url}_${item.match_poll_id || 'no_match'}`;
    feedback[key] = isCorrect ? 'correct' : 'incorrect';
    feedback = {...feedback}; // trigger reactivity
  }

  function getFeedbackKey(item) {
    return `${item.url}_${item.match_poll_id || 'no_match'}`;
  }

  function downloadFeedbackCSV() {
    const rows = [];
    rows.push(['URL', 'Added On', 'ID', 'Match Poll ID', 'Added On', 'Pollster', 'Sponsor', 'Feedback']);
    
    filteredData.forEach(item => {
      const key = getFeedbackKey(item);
      if (feedback[key]) {
        let confidence = 'N/A';
        let pollster = 'N/A';
        let sponsor = 'N/A';
        
        if (item.match_results) {
          const matchData = typeof item.match_results === 'string' ? JSON.parse(item.match_results) : item.match_results;
          confidence = matchData?.matches?.[0]?.confidence || 'N/A';
          pollster = matchData?.matches?.[0]?.matched_poll?.pollster || 'N/A';
          sponsor = matchData?.matches?.[0]?.matched_poll?.sponsor || 'N/A';
        }
        
        rows.push([
          item.url,
          item.added_on,
          item.id,
          item.match_poll_id || 'No Match',
          item.added_on,
          pollster,
          sponsor,
          feedback[key]
        ]);
      }
    });

    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `poll_feedback_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function applyFilters() {
    filteredData = data.filter(item => {
      if (dateFilter && item.added_on) {
        const d = new Date(item.added_on);
        const itemDateStr = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0');
        if (itemDateStr !== dateFilter) return false;
      }
      if (collectionFilter) {
        const labels = extractCollections(item.collections).map(s => s.toLowerCase());
        if (!labels.includes(collectionFilter.toLowerCase())) return false;
      }
      return true;
    });

    if (sortColumn) sortData(sortColumn, false);
    
    // Update grouped data
    groupDataByPollId();
  }

  function groupDataByPollId() {
    groupedData = {};
    filteredData.forEach(item => {
      const pollId = item.match_poll_id || 'No Match';
      if (!groupedData[pollId]) {
        groupedData[pollId] = [];
      }
      groupedData[pollId].push(item);
    });
  }

  function sortData(column, toggleDirection = true) {
    if (toggleDirection) {
      if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'asc';
      }
    }
    filteredData = [...filteredData].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      if (column === 'added_on') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  onMount(async () => {
    const apiUrl = `https://pollfinderpdfs.s3.us-east-2.amazonaws.com/pollfinder/matched_polls.json?t=${Date.now()}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = await response.json();

      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        const columns = Object.keys(parsed);
        const firstColumn = parsed[columns[0]];
        const numRows = Object.keys(firstColumn).length;
        data = [];
        for (let i = 0; i < numRows; i++) {
          const row = {};
          columns.forEach(col => (row[col] = parsed[col][i]));
          data.push(row);
        }
      } else if (Array.isArray(parsed)) {
        data = parsed;
      }

      if (data.length > 0) {
        const collectionsSet = new Map();
        data.forEach(item => {
          extractCollections(item.collections).forEach(label => {
            const key = label.toLowerCase();
            if (!collectionsSet.has(key)) collectionsSet.set(key, label);
          });
        });
        uniqueCollections = Array.from(collectionsSet.values()).sort((a, b) => a.localeCompare(b));

        let allColumns = Object.keys(data[0]).filter(f => f !== 'id' && f !== 'num_polls_found' && f !== 'collections');
        const urlIndex = allColumns.indexOf('url');
        const addedOnIndex = allColumns.indexOf('added_on');
        if (urlIndex !== -1 && addedOnIndex !== -1) {
          [allColumns[urlIndex], allColumns[addedOnIndex]] = [allColumns[addedOnIndex], allColumns[urlIndex]];
        }
        // Add feedback column at the end
        allColumns.push('feedback');
        columnOrder = allColumns;

        filteredData = [...data];
        applyFilters();
        sortData('added_on', false);
      }
      loading = false;
    } catch (err) {
      error = err.message;
      loading = false;
    }
  });
</script>

<!-- ====== HEADER ====== -->
<header class="site-header">
  <div class="site-header__inner container">
    <a class="brand" href="/" aria-label="Pollfinder home">
      <!-- Simple, bold wordmark + glyph -->
      <svg class="brand__glyph" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="16.5" y1="16.5" x2="22" y2="22"></line>
      </svg>
      <span class="brand__name">Pollfinder</span>
    </a>

    <nav class="top-nav" aria-label="Primary">
      <a href="#data">Data</a>
      <a href="#about">About</a>
      <a href="#methods">Methods</a>
    </nav>
  </div>
</header>

<!-- ====== INTRO / HERO ====== -->
<article class="container">
  <div class="hero">
    <div class="hero__copy">
      <h1>Poll Detector</h1>
      <p class="dek">Detect poll mentions in the wild using large language models, then structure the results for analysis.</p>

      <div class="filters">
        <div class="field">
          <label for="date">Date</label>
          <input id="date" type="date" bind:value={dateFilter} on:change={applyFilters} />
          {#if dateFilter}
            <button class="btn ghost" on:click={() => { dateFilter = ''; applyFilters(); }}>Clear</button>
          {/if}
        </div>

        <div class="field">
          <label for="collection">Collection</label>
          <select id="collection" bind:value={collectionFilter} on:change={applyFilters}>
            <option value="">All collections</option>
            {#each uniqueCollections as collection}
              <option value={collection}>{collection}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="view">View</label>
          <select id="view" bind:value={viewMode}>
            <option value="table">Table View</option>
            <option value="grouped">Grouped by Match ID</option>
          </select>
        </div>

        {#if Object.keys(feedback).length > 0}
          <div class="field">
            <button class="btn" on:click={downloadFeedbackCSV}>
              Download Feedback CSV ({Object.keys(feedback).length})
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</article>

<!-- ====== DATA TABLE ====== -->
<main id="data" class="container">
  {#if loading}
    <div class="notice">Loading data…</div>
  {:else if error}
    <div class="notice error">
      <strong>Error:</strong> {error}
    </div>
  {:else if data.length > 0}
    {#if viewMode === 'table'}
      <div class="card table-card">
        <div class="table-scroll">
          <table class="data-table">
          <thead>
            <tr>
              {#each columnOrder as field}
                <th class:sortable={field !== 'feedback'} on:click={() => field !== 'feedback' && sortData(field)}>
                  {#if field === 'polls'}
                    🤖 Extracted Polls
                  {:else if field === 'match_results'}
                    Matched Poll
                  {:else if field === 'match_poll_id'}
                    Matched Poll ID
                  {:else if field === 'feedback'}
                    Feedback
                  {:else}
                    {field}
                  {/if}
                  {#if sortColumn === field && field !== 'feedback'}
                    <span class="sort">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each filteredData as item}
              <tr>
                {#each columnOrder as field}
                  <td>
                    {#if field === 'url' && item[field]}
                      {@const url = new URL(item[field])}
                      {@const domain = url.hostname.replace('www.', '')}
                      {@const path = url.pathname + url.search}
                      <a class="url-link" href={item[field]} target="_blank" rel="noopener noreferrer" title={item[field]}>
                        <span class="url-domain">{domain}</span>
                        <span class="url-path">{path.length > 40 ? path.substring(0, 40) + '…' : path}</span>
                      </a>
                    {:else if field === 'added_on' && item[field]}
                      {@const dateObj = new Date(item[field])}
                      {@const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {@const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      <div class="datetime">
                        <div class="date">{dateStr}</div>
                        <div class="time">{timeStr}</div>
                      </div>
                    {:else if field === 'match_poll_id' && item[field]}
                      <!-- <div class="poll-id-badge"> -->
                        <span class="badge-value">{item[field]}</span>
                      <!-- </div> -->
                    {:else if field === 'match_results' && item[field]}
                      {#if typeof item[field] === 'string'}
                        {@const parsed = JSON.parse(item[field])}
                        {#if parsed.matches && parsed.matches.length > 0 && parsed.matches[0].matched_poll}
                          {@const matchedPoll = parsed.matches[0].matched_poll}
                          {@const {poll_id, ...pollWithoutId} = matchedPoll}
                          <div class="match-card">
                            <div class="match-field">
                              <span class="field-label">Pollster:</span>
                              <span class="field-value">{pollWithoutId.pollster || 'N/A'}</span>
                            </div>
                            <div class="match-field">
                              <span class="field-label">Sponsor:</span>
                              <span class="field-value">{pollWithoutId.sponsor || 'N/A'}</span>
                            </div>
                            <div class="match-field">
                              <span class="field-label">Date:</span>
                              <span class="field-value">{pollWithoutId.date || 'N/A'}</span>
                            </div>
                            <div class="match-field">
                              <span class="field-label">Location:</span>
                              <span class="field-value">{pollWithoutId.location || 'N/A'}</span>
                            </div>
                            <div class="match-field">
                              <span class="field-label">Sample:</span>
                              <span class="field-value">{pollWithoutId.sample_size || 'N/A'}</span>
                            </div>
                          </div>
                        {:else}
                          <span class="muted">No match found</span>
                        {/if}
                      {:else if item[field].matches && item[field].matches.length > 0 && item[field].matches[0].matched_poll}
                        {@const matchedPoll = item[field].matches[0].matched_poll}
                        {@const {poll_id, ...pollWithoutId} = matchedPoll}
                        <div class="match-card">
                          <div class="match-field">
                            <span class="field-label">Pollster:</span>
                            <span class="field-value">{pollWithoutId.pollster || 'N/A'}</span>
                          </div>
                          <div class="match-field">
                            <span class="field-label">Sponsor:</span>
                            <span class="field-value">{pollWithoutId.sponsor || 'N/A'}</span>
                          </div>
                          <div class="match-field">
                            <span class="field-label">Date:</span>
                            <span class="field-value">{pollWithoutId.date || 'N/A'}</span>
                          </div>
                          <div class="match-field">
                            <span class="field-label">Location:</span>
                            <span class="field-value">{pollWithoutId.location || 'N/A'}</span>
                          </div>
                          <div class="match-field">
                            <span class="field-label">Sample:</span>
                            <span class="field-value">{pollWithoutId.sample_size || 'N/A'}</span>
                          </div>
                        </div>
                      {:else}
                        <span class="muted">No match found</span>
                      {/if}
                    {:else if field === 'polls' && item[field]}
                      {@const pollsArray = Array.isArray(item[field]) ? item[field] : [item[field]]}
                      {#if pollsArray.length > 0}
                        {#each pollsArray.slice(0, 3) as rawPoll, idx}
                          {@const poll = coercePoll(rawPoll)}
                          {#if poll}
                            <div class="match-card" style="margin-bottom: 8px;">
                              <div class="match-field">
                                <span class="field-label">Pollster:</span>
                                <span class="field-value">{poll.pollster || 'N/A'}</span>
                              </div>
                              <div class="match-field">
                                <span class="field-label">Sponsor:</span>
                                <span class="field-value">{poll.sponsor || 'N/A'}</span>
                              </div>
                              <div class="match-field">
                                <span class="field-label">Date:</span>
                                <span class="field-value">{poll.date || 'N/A'}</span>
                              </div>
                              <div class="match-field">
                                <span class="field-label">Location:</span>
                                <span class="field-value">{poll.location || 'N/A'}</span>
                              </div>
                              <div class="match-field">
                                <span class="field-label">Sample:</span>
                                <span class="field-value">{getSample(poll)}</span>
                              </div>

                              {#if poll.poll_url}
                                <div class="match-field">
                                  <span class="field-label">Link:</span>
                                  <span class="field-value">
                                    <a href={poll.poll_url} target="_blank" rel="noopener noreferrer">Source</a>
                                  </span>
                                </div>
                              {/if}
                            </div>
                          {:else}
                            <!-- Fallback if we can't parse the entry -->
                            <div class="match-field" style="margin-bottom: 8px;">
                              <span class="field-label">Poll {idx + 1}:</span>
                              <span class="field-value">{typeof rawPoll === 'string' ? rawPoll : JSON.stringify(rawPoll)}</span>
                            </div>
                          {/if}
                        {/each}

                        {#if pollsArray.length > 3}
                          <div class="poll-more">+{pollsArray.length - 3} more poll{pollsArray.length - 3 > 1 ? 's' : ''}</div>
                        {/if}
                      {:else}
                        <span class="muted">No poll info</span>
                      {/if}
                    {:else if field === 'feedback'}
                      {@const feedbackKey = getFeedbackKey(item)}
                      <div class="feedback-buttons">
                        <button 
                          class="btn-feedback" 
                          class:selected={feedback[feedbackKey] === 'correct'}
                          on:click={() => handleFeedback(item, true)}
                        >
                          ✓ Correct
                        </button>
                        <button 
                          class="btn-feedback" 
                          class:selected={feedback[feedbackKey] === 'incorrect'}
                          on:click={() => handleFeedback(item, false)}
                        >
                          ✗ Incorrect
                        </button>
                      </div>
                    {:else if typeof item[field] === 'object' && item[field] !== null}
                      <pre class="json">{JSON.stringify(item[field], null, 2)}</pre>
                    {:else}
                      {item[field] || ''}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    {:else}
      <!-- Grouped View -->
      <div class="grouped-view">
        {#each Object.entries(groupedData).sort(([a], [b]) => {
          if (a === 'No Match') return 1;
          if (b === 'No Match') return -1;
          return a.localeCompare(b);
        }) as [pollId, items]}
          <div class="group-card">
            <h3 class="group-header">
              <span class="group-id">Match ID: {pollId}</span>
              <span class="group-count">{items.length} article{items.length !== 1 ? 's' : ''}</span>
            </h3>
            
            {#if pollId !== 'No Match' && items[0].match_results}
              {#if typeof items[0].match_results === 'string'}
                {@const firstItem = items[0]}
                {@const parsed = JSON.parse(firstItem.match_results)}
                {#if parsed.matches && parsed.matches.length > 0 && parsed.matches[0].matched_poll}
                  {@const matchedPoll = parsed.matches[0].matched_poll}
                  {@const {poll_id, ...pollWithoutId} = matchedPoll}
                  <div class="match-card group-match">
                    <h4 class="match-title">📊 Matched Poll (Database)</h4>
                    <div class="match-field">
                      <span class="field-label">Pollster:</span>
                      <span class="field-value">{pollWithoutId.pollster || 'N/A'}</span>
                    </div>
                    <div class="match-field">
                      <span class="field-label">Sponsor:</span>
                      <span class="field-value">{pollWithoutId.sponsor || 'N/A'}</span>
                    </div>
                    <div class="match-field">
                      <span class="field-label">Date:</span>
                      <span class="field-value">{pollWithoutId.date || 'N/A'}</span>
                    </div>
                    <div class="match-field">
                      <span class="field-label">Location:</span>
                      <span class="field-value">{pollWithoutId.location || 'N/A'}</span>
                    </div>
                    <div class="match-field">
                      <span class="field-label">Sample:</span>
                      <span class="field-value">{pollWithoutId.sample_size || 'N/A'}</span>
                    </div>
                  </div>
                {/if}
              {/if}
            {/if}

            <div class="group-table-wrapper">
              <table class="group-table">
                <thead>
                  <tr>
                    <th>Added On</th>
                    <th>URL</th>
                    <th>Pollster</th>
                    <th>Sponsor</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Sample Size</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {#each items as item}
                    {@const url = new URL(item.url)}
                    {@const domain = url.hostname.replace('www.', '')}
                    {@const path = url.pathname + url.search}
                    {@const dateObj = new Date(item.added_on)}
                    {@const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {@const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    {@const pollsArray = Array.isArray(item.polls) ? item.polls : [item.polls]}
                    {#if item.match_results}
                      {@const matchData = typeof item.match_results === 'string' ? JSON.parse(item.match_results) : item.match_results}
                      {@const confidence = matchData?.matches?.[0]?.confidence || 'N/A'}
                      {#each pollsArray as rawPoll}
                        {@const poll = coercePoll(rawPoll)}
                        {#if poll}
                          <tr>
                            <td class="date-cell">
                              <div class="date">{dateStr}</div>
                              <div class="time">{timeStr}</div>
                            </td>
                            <td class="url-cell">
                              <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>
                                <span class="url-domain">{domain}</span>
                                <span class="url-path">{path.length > 40 ? path.substring(0, 40) + '…' : path}</span>
                              </a>
                            </td>
                            <td>{poll.pollster || 'N/A'}</td>
                            <td>{poll.sponsor || 'N/A'}</td>
                            <td>{poll.start_date || poll.date || 'N/A'}</td>
                            <td>{poll.end_date || 'N/A'}</td>
                            <td>{getSample(poll)}</td>
                            <td>{typeof confidence === 'number' ? confidence.toFixed(2) : confidence}</td>
                          </tr>
                        {/if}
                      {/each}
                    {:else}
                      {#each pollsArray as rawPoll}
                        {@const poll = coercePoll(rawPoll)}
                        {#if poll}
                          <tr>
                            <td class="date-cell">
                              <div class="date">{dateStr}</div>
                              <div class="time">{timeStr}</div>
                            </td>
                            <td class="url-cell">
                              <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>
                                <span class="url-domain">{domain}</span>
                                <span class="url-path">{path.length > 40 ? path.substring(0, 40) + '…' : path}</span>
                              </a>
                            </td>
                            <td>{poll.pollster || 'N/A'}</td>
                            <td>{poll.sponsor || 'N/A'}</td>
                            <td>{poll.start_date || poll.date || 'N/A'}</td>
                            <td>{poll.end_date || 'N/A'}</td>
                            <td>{getSample(poll)}</td>
                            <td>N/A</td>
                          </tr>
                        {/if}
                      {/each}
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="notice">No data found.</div>
  {/if}
</main>

<!-- ====== FOOTER ====== -->
<footer class="site-footer">
  <div class="container footer-inner">
    <p id="about" class="muted">© {new Date().getFullYear()} Pollfinder • Built for structured poll discovery.</p>
  </div>
</footer>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500..800&family=Inter:wght@400;500;600;700&display=swap');

  :root{
    --ink: #111827;          /* near-black */
    --ink-2:#374151;         /* gray-700 */
    --ink-3:#6b7280;         /* gray-500 */
    --paper:#ffffff;
    --paper-2:#f8fafc;       /* page wash */
    --line:#e5e7eb;          /* subtle rule */
    --brand:#1f4db3;         /* ProPublica-like blue */
    --brand-2:#0b3a8f;
    --accent:#236bb1;
    --warn:#b85d20;
    --radius:14px;
    --shadow:0 6px 24px rgba(17,24,39,.06);
  }

  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--paper-2); color:var(--ink); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji", "Segoe UI Symbol";}

  h1{font-family:"Source Serif 4", Georgia, 'Times New Roman', serif; font-weight:800; font-size: clamp(32px, 4vw, 52px); line-height:1.05; letter-spacing:-.01em; margin:0 0 .35rem}
  .dek{font-size:1.125rem; color:var(--ink-2); max-width:60ch; margin:.25rem 0 1.25rem}
  a{color:var(--brand); text-decoration:none}
  a:hover{text-decoration:underline}
  .muted{color:var(--ink-3)}

  .container{max-width:1152px; margin:0 auto; padding:0 20px}

  /* HEADER */
  .site-header{background:#0d1530; color:#fff; border-bottom:1px solid rgba(255,255,255,.08); position:sticky; top:0; z-index:50}
  .site-header__inner{display:flex; align-items:center; justify-content:space-between; padding:14px 20px}
  .brand{display:flex; align-items:center; gap:.6rem; color:#fff; text-decoration:none}
  .brand__glyph{width:22px; height:22px; stroke:#9fb6ff; stroke-width:2.2; fill:none}
  .brand__name{font-weight:800; letter-spacing:.2px}
  .top-nav a{color:#c7d2fe; margin-left:18px; font-weight:600}
  .top-nav a:hover{color:#fff}

  /* HERO */
  .hero{display:grid; grid-template-columns:1.2fr .8fr; gap:28px; padding:28px 0 10px}
  .hero__copy{padding-top:8px}
  .hero__art{display:flex; align-items:center; justify-content:flex-end}
  .hero__art img{max-width:200px; width:100%}

  /* FILTERS */
  .filters{display:flex; gap:14px; flex-wrap:wrap; background:#eef2ff; border:1px solid #e0e7ff; padding:14px}
  .field{display:flex; align-items:center; gap:10px}
  label{font-weight:700; color:var(--brand)}
  input[type="date"], select{
    appearance:none;
    padding:10px 12px;
    border:1px solid #cbd5e1;
    background:#fff;
    font:inherit;
    min-width:220px;
    outline:none;
    transition:border-color .15s ease;
  }
  input[type="date"]:focus, select:focus{border-color:#93c5fd}

  .btn{
    border:1px solid var(--line);
    background:#fff;
    padding:8px 12px;
    font-weight:600;
    cursor:pointer;
    transition:all .2s ease;
  }
  .btn.ghost{background:transparent; color:var(--ink-2)}
  .btn:hover{border-color:#cbd5e1}

  /* FEEDBACK BUTTONS */
  .feedback-buttons{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
  }
  .btn-feedback{
    padding:6px 12px;
    border:1px solid #cbd5e1;
    background:#fff;
    font-size:0.85rem;
    font-weight:600;
    cursor:pointer;
    transition:all .2s ease;
    border-radius:4px;
  }
  .btn-feedback:hover{
    border-color:#94a3b8;
  }
  .btn-feedback.selected{
    background:#22c55e;
    border-color:#16a34a;
    color:#fff;
  }
  .btn-feedback:nth-child(2).selected{
    background:#ef4444;
    border-color:#dc2626;
  }

  /* CARDS */
  .card{background:var(--paper); border:1px solid var(--line)}
  .table-card{margin:18px 0 48px}

  /* TABLE */
  .table-scroll{overflow:auto}
  table{width:100%; border-collapse:separate; border-spacing:0}
  thead th{
    position:sticky; top:0;
    background:#f3f4f6;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.02em;
    font-size:.78rem;
    border-bottom:1px solid var(--line);
    color:#374151;
    padding:12px 10px;
  }
  th.sortable{cursor:pointer; user-select:none}
  th.sortable:hover{background:#e5e7eb}
  .sort{margin-left:6px; font-size:.75rem; color:#6b7280}

  tbody td{padding:10px; border-top:1px solid var(--line); vertical-align:top; background:#fff}
  tbody tr:nth-child(odd) td{background:#fcfcfd}
  tbody tr:hover td{background:#f9fafb}

  .datetime{
    display:flex;
    flex-direction:column;
    gap:2px;
    line-height:1.2;
    white-space:nowrap;
  }
  .datetime .date{
    font-size:0.8rem;
    font-weight:400;
    color:var(--ink);
  }
  .datetime .time{
    font-size:0.75rem;
    color:var(--ink-3);
    font-weight:400;
  }

  .url-link{
    display:flex;
    flex-direction:column;
    gap:2px;
    text-decoration:none;
    color:inherit;
    line-height:1.3;
    max-width:300px;
  }
  .url-link:hover{
    opacity:0.8;
  }
  .url-link:hover .url-domain{
    text-decoration:underline;
  }
  .url-domain{
    font-size:0.9rem;
    font-weight:600;
    color:var(--brand);
  }
  .url-path{
    font-size:0.75rem;
    color:var(--ink-3);
    font-family:monospace;
    word-break:break-all;
  }

  .poll-id-badge{
    display:inline-flex;
    align-items:center;
    gap:6px;
    background:#eff6ff;
    border:1px solid #bfdbfe;
    padding:6px 12px;
  }
  .badge-label{
    font-size:0.7rem;
    font-weight:700;
    color:#1e40af;
    text-transform:uppercase;
    letter-spacing:0.03em;
  }
  .badge-value{
    font-size:0.85rem;
    font-weight:600;
    color:#1e3a8a;
    font-family:monospace;
  }

  .match-card{
    display:flex;
    flex-direction:column;
    gap:6px;
    padding:10px;
    background:#f8fafc;
    border:1px solid #e2e8f0;
    min-width:250px;
  }
  .match-field{
    display:flex;
    gap:8px;
    font-size:0.85rem;
    line-height:1.4;
  }
  .field-label{
    font-weight:600;
    color:var(--ink-2);
    min-width:70px;
    flex-shrink:0;
  }
  .field-value{
    color:var(--ink);
    font-weight:400;
  }

  .polls-card{
    display:flex;
    flex-direction:column;
    gap:6px;
    padding:10px;
    background:#f8fafc;
    border:1px solid #e2e8f0;
    min-width:250px;
  }
  .poll-more{
    font-size:0.75rem;
    color:var(--ink-3);
    font-style:italic;
    padding-top:4px;
    border-top:1px solid #e2e8f0;
    margin-top:2px;
  }

  /* GROUPED VIEW */
  .grouped-view{
    display:flex;
    flex-direction:column;
    gap:24px;
  }
  .group-card{
    background:var(--paper);
    border:1px solid var(--line);
    padding:20px;
  }
  .group-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin:0 0 16px;
    padding-bottom:12px;
  }
  .group-id{
    font-size:1.1rem;
    font-weight:700;
    color:var(--ink);
  }
  .group-count{
    font-size:0.9rem;
    color:var(--ink-3);
    font-weight:600;
  }
  .group-match{
    margin-bottom:20px;
  }
  .match-title{
    font-size:0.95rem;
    font-weight:700;
    color:var(--ink-2);
    margin:0 0 8px;
  }
  .items-title{
    font-size:0.9rem;
    font-weight:700;
    color:var(--ink-2);
    margin:0 0 12px;
  }
  .group-table-wrapper{
    overflow-x:auto;
    margin-top:16px;
  }
  .group-table{
    width:100%;
    border-collapse:collapse;
    font-size:0.9rem;
  }
  .group-table thead{
    background:#f1f5f9;
    border-bottom:2px solid var(--line);
  }
  .group-table th{
    text-align:left;
    padding:10px 12px;
    font-weight:700;
    color:var(--ink-2);
    white-space:nowrap;
  }
  .group-table td{
    padding:10px 12px;
    border-bottom:1px solid #e2e8f0;
    color:var(--ink);
  }
  .group-table tbody tr:hover{
    background:#f8fafc;
  }
  .date-cell{
    white-space:nowrap;
  }
  .date-cell .date{
    font-weight:600;
    font-size:0.9rem;
  }
  .date-cell .time{
    font-size:0.75rem;
    color:var(--ink-3);
  }
  .url-cell a{
    text-decoration:none;
    color:inherit;
  }
  .url-cell a:hover{
    text-decoration:underline;
  }
  .url-cell .url-domain{
    font-weight:600;
    color:var(--brand);
    display:block;
  }
  .url-cell .url-path{
    font-size:0.75rem;
    color:var(--ink-3);
    font-family:monospace;
    display:block;
  }

  .link-wrap{word-break:break-word}
  .json{
    background:#f8fafc;
    border:1px solid #e5e7eb;
    padding:8px;
    font-size:.85rem;
    max-width:360px;
    overflow:auto;
  }

  /* NOTICES */
  .notice{background:#eef2ff; border:1px solid #dbeafe; color:#1e3a8a; padding:12px 14px; margin:16px 0;}
  .notice.error{background:#fff1f2; border-color:#fecdd3; color:#991b1b}

  /* FOOTER */
  .site-footer{border-top:1px solid var(--line); background:#fff}
  .footer-inner{padding:32px 20px}

  /* RESPONSIVE */
  @media (max-width: 960px){
    .hero{grid-template-columns:1fr; gap:14px}
    .hero__art{justify-content:flex-start}
    .hero__art img{max-width:150px}
  }

  .table-card .data-table a{color:var(--warn)}
  .table-card .data-table a:hover{opacity:.9}
</style>
