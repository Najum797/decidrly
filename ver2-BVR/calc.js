/* ============================================================
   calc01 — Shared JavaScript Library  v2.1
   CHANGE LOG v2.1:
   - Forex.load() switched from frankfurter.app (33 currencies,
     missing PKR/NGN/BDT/MYR/QAR/KWD/ZAR/TRY) to
     open.er-api.com/v6/latest/USD (160+ currencies, free, no key)
   - Static fallback updated with fresher approximate rates
   - All other modules unchanged
   ============================================================ */

/* ── 1. NUMBER FORMATTING ── */
const Fmt = {
  number(val, decimals = 0) {
    if (isNaN(val) || val === null) return '—';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(val);
  },

  currency(val, symbol = '$', decimals = 0) {
    if (isNaN(val) || val === null) return '—';
    const abs = Math.abs(val);
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(abs);
    return (val < 0 ? '-' : '') + symbol + formatted;
  },

  percent(val, decimals = 1) {
    if (isNaN(val) || val === null) return '—';
    return val.toFixed(decimals) + '%';
  },

  parseFormatted(str) {
    if (typeof str === 'number') return str;
    return parseFloat(String(str).replace(/,/g, '')) || 0;
  },

  compact(val, sym) {
    const abs = Math.abs(val);
    if (abs >= 1e9) return sym + (val / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sym + (val / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sym + (val / 1e3).toFixed(0) + 'K';
    return sym + Fmt.number(val);
  }
};

/* ── 2. COMMA INPUT FORMATTING ── */
function attachCommaFormat(inputEl) {
  inputEl.addEventListener('input', function () {
    const raw = this.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const pos = this.selectionStart;
    const oldLen = this.value.length;
    this.value = parts.join('.');
    const newLen = this.value.length;
    this.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
  });
}

function initCommaInputs() {
  document.querySelectorAll('.comma-input').forEach(attachCommaFormat);
}

/* ── 3. SLIDER SYNC ── */
function initSliders() {
  document.querySelectorAll('.calc-slider').forEach(slider => {
    const targetId = slider.dataset.target;
    const display  = document.getElementById(targetId + '-display');
    const suffix   = slider.dataset.suffix || '%';

    function sync() {
      if (display) display.textContent = slider.value + suffix;
    }

    slider.addEventListener('input', () => {
      sync();
      if (typeof window.recalculate === 'function') window.recalculate();
    });

    sync();
  });
}

/* ── 4. FOREX ENGINE ── */
const Forex = {
  rates: {},
  base: 'USD',
  loaded: false,

  /*
   * STATIC FALLBACK — used when the live API is unreachable.
   * Approximate rates vs USD (Apr 2025).
   * Covers every currency in the calculator dropdowns.
   */
  STATIC_FALLBACK: {
    USD: 1,     EUR: 0.92,  GBP: 0.79,  PKR: 278.5, AED: 3.67,
    AUD: 1.53,  CAD: 1.36,  INR: 83.1,  SAR: 3.75,  JPY: 149.2,
    CHF: 0.90,  CNY: 7.24,  SGD: 1.34,  MYR: 4.72,  BDT: 110.2,
    KWD: 0.31,  QAR: 3.64,  OMR: 0.38,  BHD: 0.38,  ZAR: 18.6,
    NGN: 1580,  KES: 129,   EGP: 30.9,  TRY: 32.1,  BRL: 4.97,
    MXN: 17.1,  IDR: 15680, THB: 35.1,  VND: 24500, PHP: 56.2
  },

  /*
   * LIVE RATE SOURCE: open.er-api.com
   * - Free tier, no API key required
   * - Covers 160+ currencies including PKR, NGN, BDT, MYR,
   *   QAR, KWD, ZAR, TRY — all missing from frankfurter.app
   * - Updated every ~24 h on free tier
   * - CORS-friendly, reliable uptime
   *
   * Previous source (frankfurter.app) only covered ~33 ECB
   * currencies and was missing most currencies in this calculator,
   * which caused the fallback warning to always appear for PKR users.
   */
  async load(statusEl) {
    if (statusEl) {
      statusEl.innerHTML = '<span class="spinner"></span> Fetching live rates…';
    }
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('API returned non-success');

      /* open.er-api returns rates directly under data.rates */
      this.rates = { USD: 1, ...data.rates };
      this.loaded = true;

      if (statusEl) {
        const now = new Date().toLocaleTimeString();
        statusEl.innerHTML =
          `<span style="color:var(--success)">✓</span> Live rates loaded — ${now}`;
      }
    } catch (err) {
      /* Fall back to static rates — show warning but keep working */
      this.rates  = { ...this.STATIC_FALLBACK };
      this.loaded = false;
      console.warn('Forex live fetch failed, using static fallback:', err.message);
      if (statusEl) {
        statusEl.innerHTML =
          `<span style="color:var(--warning)">⚠</span> Using offline rates (live fetch failed)`;
      }
    }
  },

  convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    const fromRate = this.rates[fromCurrency] || 1;
    const toRate   = this.rates[toCurrency]   || 1;
    return (amount / fromRate) * toRate;
  },

  getSymbol(code) {
    const symbols = {
      USD:'$', EUR:'€', GBP:'£', PKR:'₨', AED:'د.إ', AUD:'A$',
      CAD:'C$', INR:'₹', SAR:'﷼', JPY:'¥', CHF:'CHF', CNY:'¥',
      SGD:'S$', MYR:'RM', BDT:'৳', KWD:'KD', QAR:'QR', OMR:'OMR',
      BHD:'BD', ZAR:'R', NGN:'₦', KES:'KSh', EGP:'E£', TRY:'₺',
      BRL:'R$', MXN:'MX$', IDR:'Rp', THB:'฿', VND:'₫', PHP:'₱'
    };
    return symbols[code] || code;
  }
};

/* ── 5. CITY PRESETS ── */
const CityPresets = {
  markets: {
    PK: {
      label: 'Pakistan',
      currency: 'PKR',
      cities: {
        'Karachi':    { homePrice:15000000, downPct:20, mortRate:22, loanYears:15, monthlyRent:80000,  rentGrowth:8, propTax:0.5, appreciation:8,  investReturn:12, maintenance:1.5, insurance:50000, hoa:0, discount:8 },
        'Lahore':     { homePrice:20000000, downPct:20, mortRate:22, loanYears:15, monthlyRent:90000,  rentGrowth:9, propTax:0.5, appreciation:10, investReturn:12, maintenance:1.5, insurance:60000, hoa:0, discount:8 },
        'Islamabad':  { homePrice:25000000, downPct:25, mortRate:22, loanYears:15, monthlyRent:120000, rentGrowth:7, propTax:0.5, appreciation:9,  investReturn:12, maintenance:1.0, insurance:70000, hoa:0, discount:8 },
        'Rawalpindi': { homePrice:12000000, downPct:20, mortRate:22, loanYears:15, monthlyRent:55000,  rentGrowth:7, propTax:0.5, appreciation:8,  investReturn:12, maintenance:1.5, insurance:40000, hoa:0, discount:8 },
        'Peshawar':   { homePrice:8000000,  downPct:20, mortRate:22, loanYears:15, monthlyRent:35000,  rentGrowth:6, propTax:0.5, appreciation:7,  investReturn:12, maintenance:1.5, insurance:30000, hoa:0, discount:8 },
        'Faisalabad': { homePrice:10000000, downPct:20, mortRate:22, loanYears:15, monthlyRent:45000,  rentGrowth:7, propTax:0.5, appreciation:7,  investReturn:12, maintenance:1.5, insurance:35000, hoa:0, discount:8 }
      }
    },
    US: {
      label: 'USA',
      currency: 'USD',
      cities: {
        'New York':    { homePrice:750000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:3500, rentGrowth:4, propTax:1.5, appreciation:4, investReturn:8, maintenance:1.0, insurance:2400, hoa:800, discount:3 },
        'Los Angeles': { homePrice:900000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:3200, rentGrowth:4, propTax:1.1, appreciation:5, investReturn:8, maintenance:1.0, insurance:2800, hoa:400, discount:3 },
        'Chicago':     { homePrice:380000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:2100, rentGrowth:3, propTax:2.1, appreciation:3, investReturn:8, maintenance:1.2, insurance:1800, hoa:200, discount:3 },
        'Houston':     { homePrice:310000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:1800, rentGrowth:3, propTax:2.0, appreciation:3, investReturn:8, maintenance:1.2, insurance:2200, hoa:0,   discount:3 },
        'Dallas':      { homePrice:340000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:1900, rentGrowth:4, propTax:1.8, appreciation:4, investReturn:8, maintenance:1.2, insurance:2000, hoa:100, discount:3 },
        'Miami':       { homePrice:620000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:2800, rentGrowth:5, propTax:0.9, appreciation:5, investReturn:8, maintenance:1.2, insurance:4500, hoa:600, discount:3 },
        'Phoenix':     { homePrice:420000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:2000, rentGrowth:5, propTax:0.7, appreciation:5, investReturn:8, maintenance:1.0, insurance:1600, hoa:150, discount:3 },
        'Seattle':     { homePrice:780000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:2900, rentGrowth:4, propTax:0.9, appreciation:5, investReturn:8, maintenance:1.0, insurance:1800, hoa:300, discount:3 },
        'Austin':      { homePrice:530000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:2200, rentGrowth:5, propTax:1.8, appreciation:5, investReturn:8, maintenance:1.2, insurance:2000, hoa:200, discount:3 },
        'Denver':      { homePrice:580000,  downPct:20, mortRate:6.8, loanYears:30, monthlyRent:2400, rentGrowth:4, propTax:0.5, appreciation:4, investReturn:8, maintenance:1.0, insurance:1700, hoa:200, discount:3 }
      }
    },
    UK: {
      label: 'UK',
      currency: 'GBP',
      cities: {
        'London':     { homePrice:600000, downPct:15, mortRate:5.2, loanYears:25, monthlyRent:2800, rentGrowth:4, propTax:1.2, appreciation:4, investReturn:7, maintenance:1.0, insurance:1500, hoa:300, discount:3 },
        'Manchester': { homePrice:280000, downPct:15, mortRate:5.2, loanYears:25, monthlyRent:1400, rentGrowth:4, propTax:1.2, appreciation:4, investReturn:7, maintenance:1.0, insurance:800,  hoa:100, discount:3 },
        'Birmingham': { homePrice:250000, downPct:15, mortRate:5.2, loanYears:25, monthlyRent:1200, rentGrowth:3, propTax:1.2, appreciation:3, investReturn:7, maintenance:1.0, insurance:700,  hoa:80,  discount:3 },
        'Edinburgh':  { homePrice:330000, downPct:15, mortRate:5.2, loanYears:25, monthlyRent:1600, rentGrowth:4, propTax:1.1, appreciation:4, investReturn:7, maintenance:1.0, insurance:900,  hoa:120, discount:3 },
        'Bristol':    { homePrice:380000, downPct:15, mortRate:5.2, loanYears:25, monthlyRent:1800, rentGrowth:4, propTax:1.2, appreciation:4, investReturn:7, maintenance:1.0, insurance:1000, hoa:150, discount:3 }
      }
    },
    AE: {
      label: 'UAE',
      currency: 'AED',
      cities: {
        'Dubai':     { homePrice:1800000, downPct:20, mortRate:4.5, loanYears:25, monthlyRent:8000, rentGrowth:5, propTax:0, appreciation:5, investReturn:8, maintenance:1.0, insurance:6000, hoa:2000, discount:3 },
        'Abu Dhabi': { homePrice:1500000, downPct:20, mortRate:4.5, loanYears:25, monthlyRent:7000, rentGrowth:4, propTax:0, appreciation:4, investReturn:8, maintenance:1.0, insurance:5000, hoa:1500, discount:3 },
        'Sharjah':   { homePrice:700000,  downPct:20, mortRate:4.5, loanYears:25, monthlyRent:3500, rentGrowth:4, propTax:0, appreciation:3, investReturn:8, maintenance:1.0, insurance:2500, hoa:800,  discount:3 }
      }
    },
    AU: {
      label: 'Australia',
      currency: 'AUD',
      cities: {
        'Sydney':    { homePrice:1400000, downPct:20, mortRate:6.2, loanYears:30, monthlyRent:3800, rentGrowth:4, propTax:1.0, appreciation:5, investReturn:8, maintenance:1.0, insurance:3000, hoa:500, discount:3 },
        'Melbourne': { homePrice:1000000, downPct:20, mortRate:6.2, loanYears:30, monthlyRent:2800, rentGrowth:4, propTax:0.9, appreciation:4, investReturn:8, maintenance:1.0, insurance:2500, hoa:400, discount:3 },
        'Brisbane':  { homePrice:780000,  downPct:20, mortRate:6.2, loanYears:30, monthlyRent:2400, rentGrowth:5, propTax:0.8, appreciation:5, investReturn:8, maintenance:1.0, insurance:2000, hoa:300, discount:3 },
        'Perth':     { homePrice:650000,  downPct:20, mortRate:6.2, loanYears:30, monthlyRent:2200, rentGrowth:5, propTax:0.8, appreciation:5, investReturn:8, maintenance:1.0, insurance:1800, hoa:200, discount:3 }
      }
    }
  },

  apply(marketKey, cityName) {
    const market = this.markets[marketKey];
    if (!market) return;
    const city = market.cities[cityName];
    if (!city) return;

    const cur = document.getElementById('currency');
    if (cur) cur.value = market.currency;

    if (typeof previousCurrency !== 'undefined') {
      previousCurrency = market.currency;
    }

    const sliders = {
      downPct: city.downPct, mortRate: city.mortRate, loanYears: city.loanYears,
      rentGrowth: city.rentGrowth, propTax: city.propTax, appreciation: city.appreciation,
      investReturn: city.investReturn, maintenance: city.maintenance,
      discount: city.discount || 3
    };
    Object.entries(sliders).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
    });

    const sym = Forex.getSymbol(market.currency);
    const setMoney = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = Fmt.number(val);
    };
    setMoney('homePrice',   city.homePrice);
    setMoney('monthlyRent', city.monthlyRent);
    setMoney('hoa',         city.hoa);
    setMoney('insurance',   city.insurance);

    ['sym1','sym2','sym3','sym4','sym5'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.textContent = sym;
    });

    if (typeof window.recalculate === 'function') window.recalculate();
  }
};

/* ── 6. FINANCIAL FORMULAS ── */
const Finance = {
  pmt(principal, annualRate, years) {
    if (annualRate === 0) return principal / (years * 12);
    const r = annualRate / 100 / 12;
    const n = years * 12;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  },

  fv(presentValue, annualRate, years) {
    return presentValue * Math.pow(1 + annualRate / 100, years);
  },

  pv(futureValue, discountRate, years) {
    if (discountRate === 0) return futureValue;
    return futureValue / Math.pow(1 + discountRate / 100, years);
  },

  pvAnnuity(payment, annualRate, years) {
    if (annualRate === 0) return payment * years * 12;
    const r = annualRate / 100 / 12;
    const n = years * 12;
    return payment * (1 - Math.pow(1 + r, -n)) / r;
  },

  npv(rate, cashFlows) {
    return cashFlows.reduce((acc, cf, t) => {
      return acc + cf / Math.pow(1 + rate / 100, t + 1);
    }, 0);
  },

  totalInterest(principal, annualRate, years) {
    const monthly = this.pmt(principal, annualRate, years);
    return monthly * years * 12 - principal;
  },

  loanBalance(principal, annualRate, years, monthsPaid) {
    if (annualRate === 0) return principal - (principal / (years * 12)) * monthsPaid;
    const r = annualRate / 100 / 12;
    const n = years * 12;
    if (monthsPaid >= n) return 0;
    return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, monthsPaid)) /
           (Math.pow(1 + r, n) - 1);
  }
};

/* ── 7. MONTE CARLO ENGINE ── */
const MonteCarlo = {
  ITERATIONS: 1000,

  SIGMA: {
    appreciation:  2.0,
    rentGrowth:    1.5,
    investReturn:  2.5,
    maintenance:   1.0
  },

  randNormal(mean, stddev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + stddev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },

  run(p) {
    const {
      homePrice, downPayment, mortRate, loanYears,
      monthlyRent, rentGrowth, appreciation,
      propTax, maintenance, hoaMonthly, insurance,
      investReturn, horizon
    } = p;

    const principal       = homePrice - downPayment;
    const monthlyMortgage = Finance.pmt(principal, mortRate, loanYears);
    const results         = [];

    for (let i = 0; i < this.ITERATIONS; i++) {
      const appRate   = this.randNormal(appreciation, this.SIGMA.appreciation);
      const rentRate  = this.randNormal(rentGrowth,   this.SIGMA.rentGrowth);
      const invReturn = this.randNormal(investReturn,  this.SIGMA.investReturn);
      const maintRate = this.randNormal(maintenance,   this.SIGMA.maintenance);

      const yearlyBuyCost  = [];
      const yearlyRentCost = [];

      let currentRent       = monthlyRent;
      let cumulativeBuy     = 0;
      let cumulativeRent    = 0;
      let investmentAccount = downPayment;

      for (let y = 1; y <= horizon; y++) {
        const homeVal     = Finance.fv(homePrice, appRate, y);
        const loanBal     = y <= loanYears
          ? Finance.loanBalance(principal, mortRate, loanYears, y * 12) : 0;
        const equity      = homeVal - loanBal;
        const annualMaint = homePrice * (Math.max(maintRate, 0) / 100);
        const annualTax   = homeVal * (propTax / 100);

        cumulativeBuy  += monthlyMortgage * 12 + annualTax + annualMaint + insurance + hoaMonthly * 12;
        cumulativeRent += currentRent * 12;
        investmentAccount = Finance.fv(investmentAccount, Math.max(invReturn, 0), 1);

        yearlyBuyCost.push(cumulativeBuy - equity);
        yearlyRentCost.push(cumulativeRent - investmentAccount + downPayment);

        currentRent *= (1 + Math.max(rentRate, 0) / 100);
      }

      results.push({ yearlyBuyCost, yearlyRentCost });
    }

    const p10 = [], p50 = [], p90 = [];
    const breakEvenYears = [];

    for (let y = 0; y < horizon; y++) {
      const advantages = results.map(r => r.yearlyRentCost[y] - r.yearlyBuyCost[y]);
      advantages.sort((a, b) => a - b);
      p10.push(advantages[Math.floor(this.ITERATIONS * 0.10)]);
      p50.push(advantages[Math.floor(this.ITERATIONS * 0.50)]);
      p90.push(advantages[Math.floor(this.ITERATIONS * 0.90)]);
    }

    results.forEach(r => {
      for (let y = 0; y < horizon; y++) {
        if (r.yearlyRentCost[y] - r.yearlyBuyCost[y] > 0) {
          breakEvenYears.push(y + 1);
          break;
        }
      }
    });

    breakEvenYears.sort((a, b) => a - b);
    const len = breakEvenYears.length;
    const be10 = len ? (breakEvenYears[Math.floor(len * 0.10)] || horizon) : horizon;
    const be50 = len ? (breakEvenYears[Math.floor(len * 0.50)] || horizon) : horizon;
    const be90 = len ? (breakEvenYears[Math.floor(len * 0.90)] || horizon) : horizon;

    return { p10, p50, p90, breakEven: { be10, be50, be90 } };
  }
};

/* ── 8. CHART HELPERS ── */
const CalcCharts = {
  defaults: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1A2E',
        padding: 12,
        titleFont: { family: 'DM Sans', size: 12, weight: '600' },
        bodyFont:  { family: 'DM Sans', size: 12 },
        cornerRadius: 8,
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { family: 'DM Sans', size: 11 }, color: '#9AA3B0', maxTicksLimit: 10 }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { family: 'DM Sans', size: 11 }, color: '#9AA3B0' }
      }
    }
  },

  makeGradient(ctx, color, alpha1 = 0.18, alpha2 = 0) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    const hex = color.replace('#','');
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha1})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},${alpha2})`);
    return gradient;
  },

  lineDataset(label, data, color, dash = [], filled = false, canvasId = null) {
    let bg = 'transparent';
    if (filled && canvasId) {
      const canvas = document.getElementById(canvasId);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        bg = this.makeGradient(ctx, color);
      }
    }
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: bg,
      fill: filled,
      borderWidth: 2.5,
      borderDash: dash,
      pointRadius: 0,
      pointHoverRadius: 5,
      tension: 0.4
    };
  },

  bandDataset(label, data, color) {
    return {
      label,
      data,
      borderColor: 'transparent',
      backgroundColor: (() => {
        const hex = color.replace('#','');
        const r = parseInt(hex.slice(0,2),16);
        const g = parseInt(hex.slice(2,4),16);
        const b = parseInt(hex.slice(4,6),16);
        return `rgba(${r},${g},${b},0.08)`;
      })(),
      fill: '-1',
      borderWidth: 0,
      pointRadius: 0,
      tension: 0.4
    };
  },

  formatYAxis(symbol) {
    return {
      callback: val => {
        const abs = Math.abs(val);
        if (abs >= 1e9) return symbol + (val / 1e9).toFixed(1) + 'B';
        if (abs >= 1e6) return symbol + (val / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return symbol + (val / 1e3).toFixed(0) + 'K';
        return symbol + Fmt.number(val);
      }
    };
  }
};

/* ── 9. SHARE URL ── */
const ShareURL = {
  encode(params) {
    return btoa(encodeURIComponent(JSON.stringify(params)));
  },
  decode(hash) {
    try { return JSON.parse(decodeURIComponent(atob(hash))); }
    catch { return null; }
  },
  build(params) {
    const url = new URL(window.location.href.split('?')[0]);
    url.searchParams.set('s', this.encode(params));
    return url.toString();
  },
  read() {
    const s = new URLSearchParams(window.location.search).get('s');
    return s ? this.decode(s) : null;
  },
  copyToClipboard(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }
};

/* ── 10. EXPORT HELPERS ── */
const ExportHelper = {
  copyText(lines) { return ShareURL.copyToClipboard(lines.join('\n')); },
  printPDF()      { window.print(); }
};

/* ── 11. TOOLTIP ENGINE ── */
const Tooltips = {
  definitions: {
    currency:     'The currency for all inputs and outputs. Switch markets using the city presets above.',
    horizon:      'How many years to run the comparison. Typically matches how long you plan to stay in the home.',
    discount:     'Used to convert future costs to today\'s money (inflation adjustment). Use your country\'s average inflation rate.',
    homePrice:    'The total purchase price of the property.',
    downPct:      'The percentage of the home price you pay upfront. A higher down payment means a smaller mortgage but more cash tied up.',
    loanYears:    'How long your mortgage runs. Longer term = lower monthly payments but more total interest paid.',
    mortRate:     'The annual interest rate on your mortgage. Check your local bank rates.',
    monthlyRent:  'What you\'d pay per month in rent for an equivalent property.',
    rentGrowth:   'How much rent increases each year. Landlords typically raise rent annually.',
    propTax:      'Annual property tax as a percentage of the home\'s current value. Check your local government rates.',
    maintenance:  'Annual cost of repairs and upkeep, as a percentage of home value. 1% is a common rule of thumb.',
    hoa:          'Monthly fees paid to a homeowners association or building management (if applicable).',
    insurance:    'Annual home insurance premium. Required by most mortgage lenders.',
    investReturn: 'If you rented instead of buying, this is the annual return you\'d earn by investing the down payment in stocks/funds.',
    appreciation: 'How much the home\'s value grows per year. Varies heavily by location and market conditions.'
  },

  init() {
    document.querySelectorAll('[data-tip]').forEach(el => {
      const key  = el.dataset.tip;
      const text = this.definitions[key];
      if (!text) return;
      el.addEventListener('mouseenter', e => this.show(e.currentTarget, text));
      el.addEventListener('mouseleave', () => this.hide());
      el.addEventListener('click', e => { e.stopPropagation(); this.show(e.currentTarget, text); });
    });
    document.addEventListener('click', () => this.hide());
  },

  show(anchor, text) {
    this.hide();
    const tip = document.createElement('div');
    tip.className = 'calc-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    const rect = anchor.getBoundingClientRect();
    const tipW = 240;
    let left = rect.left + window.scrollX;
    let top  = rect.bottom + window.scrollY + 6;
    if (left + tipW > window.innerWidth - 16) left = window.innerWidth - tipW - 16;
    tip.style.cssText = `left:${left}px;top:${top}px;width:${tipW}px;`;
    requestAnimationFrame(() => tip.classList.add('visible'));
    this._current = tip;
  },

  hide() {
    if (this._current) { this._current.remove(); this._current = null; }
  }
};

/* ── 12. ACCORDION ── */
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.accordion-section');
      const isOpen  = section.classList.contains('open');
      const parent  = section.parentElement;
      parent.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
      if (!isOpen) section.classList.add('open');
    });
  });
}

/* ── 13. DOM UTILITIES ── */
function $(id)              { return document.getElementById(id); }
function setText(id, val)   { const el = $(id); if (el) el.textContent = val; }
function setHTML(id, val)   { const el = $(id); if (el) el.innerHTML   = val; }
function addClass(id, cls)  { const el = $(id); if (el) el.classList.add(cls); }
function removeClass(id,cls){ const el = $(id); if (el) el.classList.remove(cls); }

/* ── 14. INIT (runs on every page that loads this file) ── */
document.addEventListener('DOMContentLoaded', () => {
  initCommaInputs();
  initSliders();
  Tooltips.init();
});