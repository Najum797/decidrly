/* ============================================================
   calc.js  —  Shared utilities for calc01 calculator suite
   Covers:
     • Currency config & formatting
     • Comma-masked salary input
     • Box-Muller randn()
     • Generic Monte Carlo runner
     • Salary Erosion Monte Carlo engine
     • Chart helpers (fan chart, histogram)
     • Slider label sync
   ============================================================ */

'use strict';

/* ── 1. Currency config ─────────────────────────────────────── */
const CURRENCIES = {
  USD: { symbol: '$',  locale: 'en-US', code: 'USD' },
  GBP: { symbol: '£',  locale: 'en-GB', code: 'GBP' },
  EUR: { symbol: '€',  locale: 'de-DE', code: 'EUR' },
  AED: { symbol: 'AED',locale: 'ar-AE', code: 'AED' },
  PKR: { symbol: '₨',  locale: 'en-PK', code: 'PKR' },
};

/**
 * Format a number as currency.
 * @param {number} val
 * @param {string} currencyCode  e.g. 'USD'
 * @param {boolean} compact      use K/M abbreviation
 */
function fmt(val, currencyCode = 'USD', compact = false) {
  const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
  if (compact) return fmtShort(val, currencyCode);
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency',
      currency: c.code,
      maximumFractionDigits: 0,
    }).format(val);
  } catch {
    return c.symbol + ' ' + Math.round(val).toLocaleString();
  }
}

/**
 * Compact formatter: $1.2M, $450K etc.
 */
function fmtShort(val, currencyCode = 'USD') {
  const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const abs = Math.abs(val);
  let str;
  if (abs >= 1_000_000) str = (val / 1_000_000).toFixed(1) + 'M';
  else if (abs >= 1_000)  str = (val / 1_000).toFixed(1) + 'K';
  else                    str = Math.round(val).toString();
  return c.symbol + str;
}

/**
 * Return currency symbol for a given code.
 */
function currencySymbol(code) {
  return (CURRENCIES[code] || CURRENCIES.USD).symbol;
}

/* ── 2. Comma-masked salary input ───────────────────────────── */

/**
 * Attach live comma-formatting to a text input.
 * Strips non-digits on every keystroke, re-inserts commas.
 * @param {HTMLInputElement} el
 */
function commaInput(el) {
  function format(e) {
    const raw = el.value.replace(/[^0-9]/g, '');
    if (raw === '') { el.value = ''; return; }
    el.value = parseInt(raw, 10).toLocaleString('en-US');
  }
  el.addEventListener('input', format);
  el.addEventListener('focus', () => {
    // On focus, re-format to keep consistent
    const raw = el.value.replace(/[^0-9]/g, '');
    if (raw) el.value = parseInt(raw, 10).toLocaleString('en-US');
  });
  // Initial format if pre-filled
  if (el.value) {
    const raw = el.value.replace(/[^0-9]/g, '');
    if (raw) el.value = parseInt(raw, 10).toLocaleString('en-US');
  }
}

/**
 * Strip commas and parse to float.
 * @param {string} str
 * @returns {number}
 */
function parseComma(str) {
  return parseFloat(str.replace(/,/g, '')) || 0;
}

/* ── 3. Random number generation ───────────────────────────── */

/**
 * Box-Muller transform: standard normal sample.
 */
function randn() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Draw from N(mean, std).
 */
function randNormal(mean, std) {
  return mean + std * randn();
}

/* ── 4. Generic Monte Carlo runner ──────────────────────────── */

/**
 * Run a generic annual Monte Carlo simulation.
 * @param {object} opts
 *   runCount  {number}   simulations (default 5000)
 *   years     {number}   projection years
 *   initFn    {function} () => state  — initialise per-run state
 *   stepFn    {function} (state, year) => value  — return scalar metric each year
 * @returns {Array<{p10, p50, p90}>}  length = years
 */
function runMonteCarlo({ runCount = 5000, years, initFn, stepFn }) {
  // results[year][run] = value
  const results = Array.from({ length: years }, () => new Float64Array(runCount));

  for (let r = 0; r < runCount; r++) {
    const state = initFn();
    for (let y = 0; y < years; y++) {
      results[y][r] = stepFn(state, y + 1);
    }
  }

  return results.map(arr => {
    const sorted = arr.slice().sort((a, b) => a - b);
    return {
      p10: sorted[Math.floor(0.1 * runCount)],
      p50: sorted[Math.floor(0.5 * runCount)],
      p90: sorted[Math.floor(0.9 * runCount)],
      all: arr,
    };
  });
}

/* ── 5. Salary Erosion Monte Carlo engine ───────────────────── */

/**
 * Run salary erosion simulation.
 * @param {object} p — parameters
 *   monthlySalary     {number}  monthly gross
 *   inflationMean     {number}  0-1
 *   inflationStd      {number}  0-1
 *   raiseMean         {number}  0-1
 *   raiseStd          {number}  0-1
 *   raiseFrequency    {number}  1=annual, 2=every2yr, 3=every3yr, 0=never
 *   years             {number}
 *   taxRate           {number}  0-1
 *   otherDeductions   {number}  0-1
 *   lifestyleInflation{number}  0-1
 *   runCount          {number}  default 5000
 *
 * @returns {object}
 *   fanData      Array<{p10,p50,p90}> length=years — real after-tax monthly salary
 *   lifestyleData Array<number>        length=years — lifestyle cost (deterministic P50)
 *   histogram    Float64Array          — final-year real values for all runs
 *   startReal    number                — real after-tax starting salary
 *   breakEvenRaise number             — min raise % where P50 real >= start (0-1)
 *   probKeepsUp  number               — fraction of runs where final real >= start
 */
function runSalaryErosion(p) {
  const {
    monthlySalary,
    inflationMean,
    inflationStd,
    raiseMean,
    raiseStd,
    raiseFrequency,
    years,
    taxRate,
    otherDeductions,
    lifestyleInflation,
    runCount = 5000,
  } = p;

  const netFactor = 1 - taxRate - otherDeductions;
  const startReal = monthlySalary * netFactor; // year-0 baseline

  // Per-year accumulator: [year][run] = real after-tax monthly salary
  const perYearValues = Array.from({ length: years }, () => new Float64Array(runCount));

  for (let r = 0; r < runCount; r++) {
    let nominal = monthlySalary;
    let cpiIndex = 1; // cumulative inflation index

    for (let y = 1; y <= years; y++) {
      // Apply raise if this year qualifies
      if (raiseFrequency > 0 && y % raiseFrequency === 0) {
        const raise = Math.max(0, randNormal(raiseMean, raiseStd));
        nominal *= (1 + raise);
      }
      // Inflation this year
      const inf = Math.max(0, randNormal(inflationMean, inflationStd));
      cpiIndex *= (1 + inf);

      const realMonthly = (nominal / cpiIndex) * netFactor;
      perYearValues[y - 1][r] = realMonthly;
    }
  }

  // Fan data: percentiles per year
  const fanData = perYearValues.map(arr => {
    const sorted = arr.slice().sort((a, b) => a - b);
    return {
      p10: sorted[Math.floor(0.10 * runCount)],
      p50: sorted[Math.floor(0.50 * runCount)],
      p90: sorted[Math.floor(0.90 * runCount)],
    };
  });

  // Lifestyle cost curve (deterministic, grows at lifestyleInflation from startReal)
  const lifestyleData = [];
  let lifeCost = startReal;
  for (let y = 1; y <= years; y++) {
    lifeCost *= (1 + lifestyleInflation);
    lifestyleData.push(lifeCost);
  }

  // Final-year histogram
  const histogram = perYearValues[years - 1];

  // Probability salary keeps up (final year real >= startReal)
  let keepUpCount = 0;
  for (let r = 0; r < runCount; r++) {
    if (histogram[r] >= startReal) keepUpCount++;
  }
  const probKeepsUp = keepUpCount / runCount;

  // Break-even raise: binary search over raiseMean until P50 final >= startReal
  function p50AtRaise(testRaise) {
    const vals = new Float64Array(1000);
    for (let r = 0; r < 1000; r++) {
      let nominal = monthlySalary;
      let cpiIndex = 1;
      for (let y = 1; y <= years; y++) {
        if (raiseFrequency > 0 && y % raiseFrequency === 0) {
          nominal *= (1 + Math.max(0, randNormal(testRaise, raiseStd)));
        }
        cpiIndex *= (1 + Math.max(0, randNormal(inflationMean, inflationStd)));
      }
      vals[r] = (nominal / cpiIndex) * netFactor;
    }
    const sorted = vals.slice().sort((a, b) => a - b);
    return sorted[500];
  }

  let lo = 0, hi = 0.5, breakEvenRaise = hi;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (p50AtRaise(mid) >= startReal) { breakEvenRaise = mid; hi = mid; }
    else lo = mid;
  }

  return { fanData, lifestyleData, histogram, startReal, breakEvenRaise, probKeepsUp };
}

/* ── 6. Chart helpers ───────────────────────────────────────── */

const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

/**
 * Build or rebuild a fan chart (line chart with P10/P50/P90 bands + lifestyle).
 * @param {string}  canvasId
 * @param {object}  data      — { fanData, lifestyleData, startReal, years, currencyCode }
 */
function buildFanChart(canvasId, data) {
  destroyChart(canvasId);
  const { fanData, lifestyleData, startReal, years, currencyCode } = data;

  const labels = Array.from({ length: years }, (_, i) => `Y${i + 1}`);

  const p10 = fanData.map(d => d.p10);
  const p50 = fanData.map(d => d.p50);
  const p90 = fanData.map(d => d.p90);

  const ctx = document.getElementById(canvasId).getContext('2d');

  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'P90',
          data: p90,
          borderColor: 'rgba(16,185,129,0.7)',
          backgroundColor: 'rgba(16,185,129,0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'P50 (median)',
          data: p50,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: {
            target: '+1',
            above: 'rgba(59,130,246,0.07)',
          },
          tension: 0.3,
        },
        {
          label: 'P10',
          data: p10,
          borderColor: 'rgba(244,63,94,0.7)',
          backgroundColor: 'rgba(244,63,94,0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Lifestyle cost',
          data: lifestyleData,
          borderColor: '#f59e0b',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Starting real salary',
          data: Array(years).fill(startReal),
          borderColor: 'rgba(107,122,150,0.4)',
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2030',
          borderColor: '#252d3d',
          borderWidth: 1,
          titleColor: '#6b7a96',
          bodyColor: '#e8edf5',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y, currencyCode)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(37,45,61,0.6)' },
          ticks: { color: '#6b7a96', font: { family: 'DM Mono', size: 10 } },
        },
        y: {
          grid: { color: 'rgba(37,45,61,0.6)' },
          ticks: {
            color: '#6b7a96',
            font: { family: 'DM Mono', size: 10 },
            callback: v => fmtShort(v, currencyCode),
          },
        },
      },
    },
  });
}

/**
 * Build or rebuild a histogram for final-year real salary distribution.
 * @param {string}  canvasId
 * @param {object}  data  — { histogram: Float64Array, startReal, currencyCode, bins? }
 */
function buildHistogram(canvasId, data) {
  destroyChart(canvasId);
  const { histogram, startReal, currencyCode, bins = 30 } = data;

  const arr = Array.from(histogram);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const binWidth = (max - min) / bins;

  const counts = new Array(bins).fill(0);
  for (const v of arr) {
    const i = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    counts[i]++;
  }

  const labels = counts.map((_, i) => fmtShort(min + i * binWidth, currencyCode));
  const colors = counts.map((_, i) => {
    const mid = min + (i + 0.5) * binWidth;
    return mid >= startReal
      ? 'rgba(16,185,129,0.7)'
      : 'rgba(244,63,94,0.7)';
  });
  const borderColors = colors.map(c => c.replace('0.7', '1'));

  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Runs',
        data: counts,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2030',
          borderColor: '#252d3d',
          borderWidth: 1,
          titleColor: '#6b7a96',
          bodyColor: '#e8edf5',
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} runs`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6b7a96', font: { family: 'DM Mono', size: 9 }, maxRotation: 45 },
        },
        y: {
          grid: { color: 'rgba(37,45,61,0.6)' },
          ticks: { color: '#6b7a96', font: { family: 'DM Mono', size: 10 } },
        },
      },
    },
  });
}

/* ── 7. Slider sync helper ──────────────────────────────────── */

/**
 * Bind a slider to a display span.
 * @param {string} sliderId
 * @param {string} displayId
 * @param {function} [transform]  optional value → display string
 */
function bindSlider(sliderId, displayId, transform) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  const fn = transform || (v => v);
  const update = () => { display.textContent = fn(slider.value); };
  slider.addEventListener('input', update);
  update();
}

/* ── 8. Currency prefix updater ─────────────────────────────── */

/**
 * Update a .input-prefix element with the selected currency symbol.
 * @param {string} selectId     id of the <select> element
 * @param {string} prefixId     id of the .input-prefix element
 * @param {function} [onChange] optional callback(currencyCode)
 */
function bindCurrencySelect(selectId, prefixId, onChange) {
  const sel = document.getElementById(selectId);
  const prefix = document.getElementById(prefixId);
  if (!sel || !prefix) return;
  const update = () => {
    prefix.textContent = currencySymbol(sel.value);
    if (onChange) onChange(sel.value);
  };
  sel.addEventListener('change', update);
  update();
}
