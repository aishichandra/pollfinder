<script>
  import { onMount } from 'svelte';
  import { scaleLinear, scaleOrdinal } from 'd3-scale';
  import { max, min } from 'd3-array';
  import DetailCard from './DetailCard.svelte';
  import { schemeCategory10 } from 'd3-scale-chromatic';

  export let data = [];
  export let domainColumn;
  export let opacity;
  export let selectedValues = new Set();

  let canvas;
  let ctx;

  let containerWidth = 1500;
  let containerHeight = 700;

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const radius = 6;

  let hoveredData = null;
  let lastHoveredData = null;
  let zoomScale = 1;
  let zoomCenter = { x: 0, y: 0 };

  $: innerWidth = containerWidth - margin.left - margin.right;
  $: innerHeight = containerHeight - margin.top - margin.bottom;

  $: xScale = scaleLinear()
    .domain([min(data, d => d.x), max(data, d => d.x)])
    .range([0, innerWidth]);

  $: yScale = scaleLinear()
    .domain([min(data, d => d.y), max(data, d => d.y)])
    .range([innerHeight, 0]);

  const colorScale = scaleOrdinal()
    .domain([...new Set(data.map(d => d[domainColumn]))])
    .range(schemeCategory10);

  function draw() {
    ctx.clearRect(0, 0, containerWidth, containerHeight);
    ctx.save();
    ctx.translate(zoomCenter.x, zoomCenter.y);
    ctx.scale(zoomScale, zoomScale);
    ctx.translate(-zoomCenter.x, -zoomCenter.y);

    data.forEach(d => {
      if (hoveredData && hoveredData === d) return;
      ctx.beginPath();
      ctx.arc(margin.left + xScale(d.x), margin.top + yScale(d.y), radius, 0, Math.PI * 2);
      ctx.fillStyle = colorScale(d[domainColumn]);
      ctx.globalAlpha = selectedValues.has(d[domainColumn]) ? 1 : opacity * 0.3;
      ctx.fill();
    });

    if (hoveredData) {
      ctx.beginPath();
      ctx.arc(margin.left + xScale(hoveredData.x), margin.top + yScale(hoveredData.y), radius, 0, Math.PI * 2);
      ctx.fillStyle = colorScale(hoveredData[domainColumn]);
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - margin.left;
    const mouseY = event.clientY - rect.top - margin.top;

    const adjustedX = (mouseX - zoomCenter.x) / zoomScale + zoomCenter.x;
    const adjustedY = (mouseY - zoomCenter.y) / zoomScale + zoomCenter.y;

    const foundData = data.find(d => {
      const dx = xScale(d.x) - adjustedX;
      const dy = yScale(d.y) - adjustedY;
      return Math.sqrt(dx * dx + dy * dy) < radius + 3;
    });

    if (foundData) {
      hoveredData = foundData;
      lastHoveredData = foundData;
    } else {
      hoveredData = lastHoveredData;
    }

    draw();
  }

  function handleMouseLeave() {
    hoveredData = lastHoveredData;
    draw();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    draw();
  });

  $: if (ctx && data.length) draw();
</script>

<div class="chart-container">
  <canvas
    bind:this={canvas}
    width={containerWidth}
    height={containerHeight}
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
  ></canvas>
  <DetailCard {hoveredData} {data} {domainColumn} />
</div>

<style>
  .chart-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }

  canvas {
    cursor: crosshair;
    /* box-shadow: 0 4px 8px rgba(0,0,0,0.1); */
    border-radius: 8px;
    background-color: white;
  }
</style>