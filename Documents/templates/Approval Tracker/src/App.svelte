<script>
  import Grid from 'gridjs-svelte';
  import { html } from 'gridjs';
  import data from './data/data.js';


  let selectedDate = new Date().toISOString().split('T')[0];
  // let selectedDate = '2024-11-05'; 

  // $: console.log('Updated Ohio Senate Data:', ohioSenateData);
  // $: console.log('Updated Michigan Senate Data:', michiganSenateData);
  // $: console.log('Updated Texas Senate Data:', texasSenateData);

  let filterPollsMentioned = false; 

  function filterDataByDate() {
    trumpApproval = data.filter(item => 
        item.collection_name === 'poll AND (approve AND Trump)' && 
        item.added_on === selectedDate && 
        (!filterPollsMentioned || (item.polls_mentioned && item.pollster !== null))
    );

    vanceApproval = data.filter(item => 
        item.collection_name === 'poll AND (approve AND Vance)' && 
        item.added_on === selectedDate && 
        (!filterPollsMentioned || (item.polls_mentioned && item.pollster !== null))
    );

    muskApproval = data.filter(item => 
        item.collection_name === 'Approval Ratings of Elon Musk' && 
        item.added_on === selectedDate && 
        (!filterPollsMentioned || (item.polls_mentioned && item.pollster !== null))
    );

    muskFavorability = data.filter(item => 
        item.collection_name === 'poll AND ((favorable AND Musk) OR (positive AND Musk))' && 
        item.added_on === selectedDate && 
        (!filterPollsMentioned || (item.polls_mentioned && item.pollster !== null))
    );
  }

  let trumpApproval = [];
  let vanceApproval = [];
  let muskApproval = [];
  let muskFavorability = [];

  filterDataByDate();

  const formatCellValue = cell => (cell === null || cell === 'N/A' || cell === 'NA') ? '' : cell;

  const columns = [
    { 
      id: 'added_on', 
      name: 'Added On', 
      sort: true,
      formatter: cell => {
        const [year, month, day] = cell.split('-');
        return `${month}/${day}/${year}`;
      }, 
      // resizable: true 
    },
    { 
      id: 'url', 
      name: 'Article URL', 
      resizable: true,
      // width: 250,
      formatter: cell => {
        const url = new URL(cell);
        const shortenedUrl = url.hostname.replace('www.', ''); 
        return html(`<a href="${cell}" target="_blank" style="color: #b85d20; text-decoration: underline;">${shortenedUrl}...</a>`);
      }
    },
    { 
      id: 'polls_mentioned', 
      name: 'Poll?', 
      sort: true,
      formatter: cell => cell ? '✅' : '❌',
    },
    { id: 'pollster', name: 'Pollster', sort: true, formatter: formatCellValue },
    { id: 'date', name: 'Poll Date', sort: true, formatter: formatCellValue },
    { id: 'location', name: 'Location', formatter: formatCellValue },
    { id: 'sample_size', name: 'Sample Size', formatter: formatCellValue },
    { 
      id: 'poll_url', 
      name: 'Poll URL', 
      formatter: cell => cell ? html(`<a href="${cell}" target="_blank">Link</a>`) : '' 
    }
  ];

  function navigateToSection(event) {
    const value = event.target.value;
    if (value) {
      const target = document.querySelector(value);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function getRowCount(tableData) {
    return tableData.length;
  }
</script>

  
  <article class="container">
    <div class="intro-container">
      <div class="intro-text">
        <h1>Poll Detector [Draft]</h1>
        <h2>Experimenting with LLMs to help find polls 🔬</h2>
        <p class="intro-description">
          This webpage filters poll-related URLs from Google Alerts and Search.
        </p>
        <p class="intro-description">
          We collected the URLs from Google Alerts and Search using targeted keywords and used a large language model (GPT-4o) to extract key metadata—such as poll dates, pollsters, and sample sizes—to help distinguish whether or not polls were mentioned in the coverage.
        </p>
              <div class="filters-container">
              
            <!-- <h3 class="filters-subheader">Select</h3> -->
            <div class="date-filter">
                      <label>Select the Date:</label>

                      <input 
                      type="date" 
                      id="date-picker-ohio" 
                      class="date-input"
                      bind:value={selectedDate} 

                      on:input={() => {
                        filterDataByDate();
                        console.log('Date changed to:', selectedDate);
                      }}
                    />
              
        </div>
        <div class="switch-container">
                  <span class="toggle-label">Show Only Mentioned Polls:</span>
          <label class="switch">
            <input type="checkbox" bind:checked={filterPollsMentioned} on:change={() => {
              filterDataByDate();
              console.log('Toggle changed to:', filterPollsMentioned);
            }} />
            <span class="slider round"></span>
          </label>
          
        </div>
      </div>
  
  
      </div>
  
      <div class="intro-image">
        <img src="/polldetector/image2.png" alt="Poll Detector Illustration">
      </div>
          
    </div>
  
    <!-- Key Cards Section in a Full-Width Callout -->
    <div class="callout">
      <div class="keycards">
        <div class="card">
          <h3>{getRowCount(trumpApproval)}</h3>
          <p>Ohio Senate Poll URLs</p>
        </div>
        <div class="card">
          <h3>{getRowCount(vanceApproval)}</h3>
          <p>Michigan Senate Poll URLs</p>
        </div>
        <div class="card">
          <h3>{getRowCount(muskApproval)}</h3>
          <p>Texas Senate Poll URLs</p>
        </div>
        <div class="card">
          <h3>{getRowCount(muskFavorability)}</h3>
          <p>Texas Senate Poll URLs</p>
        </div>

      </div>
    </div>
  
    <section class="card" id="trump-approval-table">
      <h2 class = 'card-h2'>Donald Trump's Approval</h2>
      <div class="disclaimer">
        <p>We collect the URLs by querying Google Alerts and Google Search with the following keywords:</p>
        <pre><code>poll AND (approve AND Trump)</code></pre>
      </div>
      <Grid data={trumpApproval} columns={columns} />
      <br/>
      <!-- <p>FiveThirtyEight's <a href="https://projects.fivethirtyeight.com/polls/senate/2024/ohio/" target="_blank">Ohio Polls</a>.</p> -->

    </section>
  
    <section class="card" id="michigan-table">
      <h2 class = 'card-h2'>JD Vance's Approval</h2>
      <div class="disclaimer">
      <p>We collect the URLs by querying Google Alerts and Google Search with the following keywords:</p>
        <pre><code>poll AND (approve AND Vance)</code></pre>
      </div>
      <Grid data={vanceApproval} columns={columns} />
      <br/>
      <!-- <p>FiveThirtyEight's <a href="https://projects.fivethirtyeight.com/polls/senate/2024/michigan/" target="_blank">Michigan Polls</a>.</p> -->

    </section>
  
    <section class="card" id="musk-approval-table">
      <h2 class = 'card-h2'>Elon Musk's Approval Ratings</h2>
      <div class="disclaimer">
      <p>We collect the URLs by querying Google Alerts and Google Search with the following keywords:</p>
        <pre><code>poll AND (approve AND Musk)</code></pre>
      </div>
      <Grid data={muskApproval} columns={columns} />
      <br/>
      <!-- <p>FiveThirtyEight's <a href="https://projects.fivethirtyeight.com/polls/senate/2024/texas/" target="_blank">Texas Polls</a>.</p> -->

    </section>

    <section class="card" id="musk-fav-table">
      <h2 class = 'card-h2'>Elon Musk Favorability</h2>
      <div class="disclaimer">
      <p>We collect the URLs by querying Google Alerts and Google Search with the following keywords:</p>
        <pre><code>poll AND ((favorable AND Musk) OR (positive AND Musk))</code></pre>
      </div>
      <Grid data={muskFavorability} columns={columns} />
      <br/>
      <!-- <p>FiveThirtyEight's <a href="https://projects.fivethirtyeight.com/polls/senate/2024/texas/" target="_blank">Texas Polls</a>.</p> -->

    </section>

    <section class="card" id="methodology">
      <h2 class="card-h2">Methodology</h2>
      <div class="methodology-content">
        <p class="methodology-description">
          We used the following prompt to extract metadata related to polls mentioned in the articles:
        </p>
        <pre><code>
    {`prompt = """
      Present the metadata related to '{collection_name}' of all the polls mentioned in the article in the following JSON format:
    
      {
          "polls_mentioned": true/false,
          "polls": [
              {
                  "pollster": "Pollster name (or 'N/A' if not available)",
                  "sponsor": "Sponsor of the poll (or 'N/A' if not available)",
                  "date": "Dates the poll was conducted (or 'N/A' if not available)",
                  "location": "Location of the poll (or 'N/A' if not available)",
                  "sample_size": "Sample size of the poll (or 'N/A' if not available)",
                  "poll url": "URL of the poll (or 'N/A' if not available)"
              },
              ...
          ]
      }
    
      Make sure to include all available poll metadata, even if some fields are marked as 'N/A'.
    """`}
        </code></pre>
    
        <p class="methodology-description">
          The extracted JSON data is formatted to include all available metadata:
        </p>
        <pre><code>
    {`{
      "polls_mentioned": true,
      "polls": [
        {
          "pollster": "Example Pollster",
          "sponsor": "Example Sponsor",
          "date": "10/20/2024 - 10/22/2024",
          "location": "Ohio",
          "sample_size": "1,200",
          "poll url": "https://examplepollurl.com"
        },
        {
          "pollster": "N/A",
          "sponsor": "N/A",
          "date": "N/A",
          "location": "Michigan",
          "sample_size": "N/A",
          "poll url": "N/A"
        }
      ]
    }`}
        </code></pre>
      </div>
    </section>
    
  </article>
  
  <style>
@import 'https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css';
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Outfit:wght@100..900&family=Sora:wght@100..800&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap');

:root {
  --primary-color: #1a253c; /* Primary text color */
  --highlight-color: #236bb1; /* Highlight color */
  --focus-color: #3498db; /* Focus border color */
  --warning-color: #b85d20; /* Warning color */
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding-top: 50px;
}

article {
  margin: 0 6%;
  padding: 30px;
  width: 80%;
}

.intro-container {
  display: flex;
  align-items: stretch;
  gap: 20px;
  font-family: "Outfit", sans-serif;
  max-width: 100%;
  padding-top: 20px;
}

.intro-text {
  flex: 1;
  max-width: 60%;
}

.intro-image {
  flex: 0.4;
  display: flex;
  align-items: center;
}

.intro-image img {
  width: 100%;
  height: auto;
  object-fit: cover;
  max-width: 300px;
  margin-left: 30px;
}

h1 {
  font-size: 3.5em;
  font-weight: 800;
  color: var(--primary-color);
  margin-bottom: 10px;
}

h2 {
  font-size: 1.5em;
  font-weight: 800;
  color: var(--highlight-color);
  margin: 10px 0 20px;
  font-family: "Outfit", sans-serif;
}

.card-h2 {
  margin-top: 60px;
}

h3 {
  font-size: 45px;
  font-weight: 800;
  margin-bottom: 20px;
  font-family: "Outfit", sans-serif;
}

.intro-description {
  font-size: 1.125em;
  line-height: 1.6;
  margin-bottom: 18px;
  color: var(--primary-color);
}

.intro-author {
  font-size: 0.875em;
  margin: 30px 0 50px;
  color: var(--primary-color);
}

.intro-author a {
  text-decoration: none;
  color: var(--highlight-color);
  font-weight: 600;
}

.filters-container {
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  background-color: #f0f4ff;
  border-radius: 8px;
  padding: 5px 10px 20px 30px;
  max-width: 700px;
}

.date-filter,
.switch-container {
  margin-top: 10px;
  width: 80%;
}

.date-filter {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.date-filter label {
  font-weight: bold;
  margin-right: 10px;
  color: var(--highlight-color);
}

.date-filter input {
  padding: 10px;
  border: 1px solid;
  border-radius: 5px;
  transition: border-color 0.3s;
}

.date-filter input:focus {
  border-color: var(--focus-color);
  outline: none;
}

.switch-container {
  display: flex;
  align-items: center;
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  border-radius: 20px;
  transition: background-color 0.2s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

input:checked + .slider {
  background-color: var(--warning-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.toggle-label {
  font-weight: bold;
  margin-right: 10px;
  color: var(--highlight-color);
}

.callout {
  border-radius: 8px;
  position: relative;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 50px;
}

.keycards {
  display: flex;
  justify-content: space-around;
  margin-top: 50px;
  flex-wrap: wrap;
  width: 100%;
}

.keycards .card {
  padding-bottom: 20px;
  text-align: center;
  transition: transform 0.2s;
}

.disclaimer {
  font-size: 0.9em;
  color: #555;
  border-left: 4px;
  border-radius: 5px;
  margin: 15px 0;
}

.methodology-content {
  background-color: #fff;
  padding: 20px;
  margin-top: 20px;
  border-radius: 5px;
  border: 1px solid #ddd;
}

.methodology-description {
  font-family: 'Outfit', sans-serif;
  font-size: 1em;
  line-height: 1.5;
  color: #1a253c;
  margin: 20px 0 10px;
}

pre {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 5px;
  overflow-x: auto;
  white-space: pre-wrap;
}

code {
  font-family: 'Courier New', Courier, monospace;
  color: var(--primary-color);
  font-size: 0.95em;
}

/* Responsive design adjustments for smaller screens */
@media (max-width: 600px) {
  .intro-container {
    flex-direction: column;
  }

  .intro-text {
    max-width: 100%;
  }

  .intro-image {
    display: none;
  }
}

  </style>
  