/* ============================================================
   calc01 — Unified JavaScript Library  v3.0
   Shared by: Buy vs Rent · Salary Erosion · Freelance Income

     1.  Fmt              — BVR number/currency formatting
     2.  attachCommaFormat / initCommaInputs
     3.  initSliders      — BVR .calc-slider binding
     4.  Forex            — live rates via open.er-api.com
     5.  CityPresets      — BVR city data
     6.  Finance          — PMT, FV, PV, pvAnnuity, loanBalance
     7.  MonteCarlo       — BVR 1,000-run engine
     8.  CalcCharts       — BVR chart defaults
     9.  ShareURL
     10. ExportHelper
     11. Tooltips
     12. initAccordions
     13. DOM utils: $, setText, setHTML, addClass, removeClass
     14. CURRENCIES       — SE/Freelance currency config
     15. fmt / fmtShort / currencySymbol
     16. randn / randNormal
     17. runSalaryErosion
     18. buildFanChart / buildHistogram   — SE chart builders
     19. runFreelancerIncome
     20. buildMonthlyFanChart / buildDonutChart
     21. bindSlider / bindCurrencySelect / commaInput / parseComma
     22. PLATFORM_FEES
     23. DOMContentLoaded init
   ============================================================ */

'use strict';

/* ── 1. NUMBER FORMATTING (BVR) ─────────────────────────────── */
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
    const f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(abs);
    return (val < 0 ? '-' : '') + symbol + f;
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

/* ── 2. COMMA INPUT FORMATTING ──────────────────────────────── */
function attachCommaFormat(inputEl) {
  inputEl.addEventListener('input', function () {
    const raw = this.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const pos = this.selectionStart, oldLen = this.value.length;
    this.value = parts.join('.');
    const newLen = this.value.length;
    this.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
  });
}
function initCommaInputs() {
  document.querySelectorAll('.comma-input').forEach(attachCommaFormat);
}

/* ── 3. SLIDER SYNC (BVR .calc-slider) ─────────────────────── */
function initSliders() {
  document.querySelectorAll('.calc-slider').forEach(slider => {
    const targetId = slider.dataset.target;
    const display  = document.getElementById(targetId + '-display');
    const suffix   = slider.dataset.suffix || '%';
    function sync() { if (display) display.textContent = slider.value + suffix; }
    slider.addEventListener('input', () => {
      sync();
      if (typeof window.recalculate === 'function') window.recalculate();
    });
    sync();
  });
}

/* ── 4. FOREX ENGINE ────────────────────────────────────────── */
const Forex = {
  rates: {}, base: 'USD', loaded: false,
  STATIC_FALLBACK: {
    USD:1, EUR:0.92, GBP:0.79, PKR:278.5, AED:3.67, AUD:1.53, CAD:1.36,
    INR:83.1, SAR:3.75, JPY:149.2, CHF:0.90, CNY:7.24, SGD:1.34, MYR:4.72,
    BDT:110.2, KWD:0.31, QAR:3.64, OMR:0.38, BHD:0.38, ZAR:18.6,
    NGN:1580, KES:129, EGP:30.9, TRY:32.1, BRL:4.97,
    MXN:17.1, IDR:15680, THB:35.1, VND:24500, PHP:56.2
  },
  async load(statusEl) {
    if (statusEl) statusEl.innerHTML = '<span class="spinner"></span> Fetching live rates…';
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('non-success');
      this.rates = { USD: 1, ...data.rates };
      this.loaded = true;
      if (statusEl) {
        const now = new Date().toLocaleTimeString();
        statusEl.innerHTML = `<span style="color:var(--success)">✓</span> Live rates loaded — ${now}`;
      }
    } catch (err) {
      this.rates = { ...this.STATIC_FALLBACK };
      this.loaded = false;
      console.warn('Forex fallback:', err.message);
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--warning)">⚠</span> Using offline rates`;
    }
  },
  convert(amount, from, to) {
    if (from === to) return amount;
    return (amount / (this.rates[from] || 1)) * (this.rates[to] || 1);
  },
  getSymbol(code) {
    const s = {
      USD:'$', EUR:'€', GBP:'£', PKR:'₨', AED:'د.إ', AUD:'A$', CAD:'C$',
      INR:'₹', SAR:'﷼', JPY:'¥', CHF:'CHF', CNY:'¥', SGD:'S$', MYR:'RM',
      BDT:'৳', KWD:'KD', QAR:'QR', OMR:'OMR', BHD:'BD', ZAR:'R',
      NGN:'₦', KES:'KSh', EGP:'E£', TRY:'₺', BRL:'R$', MXN:'MX$',
      IDR:'Rp', THB:'฿', VND:'₫', PHP:'₱'
    };
    return s[code] || code;
  }
};

/* ── 5. CITY PRESETS ────────────────────────────────────────── */
const CityPresets = {
  markets: {
    PK: { label:'Pakistan', currency:'PKR', cities: {
      'Karachi':    {homePrice:15000000,downPct:20,mortRate:22,loanYears:15,monthlyRent:80000, rentGrowth:8,propTax:0.5,appreciation:8, investReturn:12,maintenance:1.5,insurance:50000,hoa:0,discount:8},
      'Lahore':     {homePrice:20000000,downPct:20,mortRate:22,loanYears:15,monthlyRent:90000, rentGrowth:9,propTax:0.5,appreciation:10,investReturn:12,maintenance:1.5,insurance:60000,hoa:0,discount:8},
      'Islamabad':  {homePrice:25000000,downPct:25,mortRate:22,loanYears:15,monthlyRent:120000,rentGrowth:7,propTax:0.5,appreciation:9, investReturn:12,maintenance:1.0,insurance:70000,hoa:0,discount:8},
      'Rawalpindi': {homePrice:12000000,downPct:20,mortRate:22,loanYears:15,monthlyRent:55000, rentGrowth:7,propTax:0.5,appreciation:8, investReturn:12,maintenance:1.5,insurance:40000,hoa:0,discount:8},
      'Peshawar':   {homePrice:8000000, downPct:20,mortRate:22,loanYears:15,monthlyRent:35000, rentGrowth:6,propTax:0.5,appreciation:7, investReturn:12,maintenance:1.5,insurance:30000,hoa:0,discount:8},
      'Faisalabad': {homePrice:10000000,downPct:20,mortRate:22,loanYears:15,monthlyRent:45000, rentGrowth:7,propTax:0.5,appreciation:7, investReturn:12,maintenance:1.5,insurance:35000,hoa:0,discount:8}
    }},
    US: { label:'USA', currency:'USD', cities: {
      'New York':    {homePrice:750000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:3500,rentGrowth:4,propTax:1.5,appreciation:4,investReturn:8,maintenance:1.0,insurance:2400,hoa:800,discount:3},
      'Los Angeles': {homePrice:900000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:3200,rentGrowth:4,propTax:1.1,appreciation:5,investReturn:8,maintenance:1.0,insurance:2800,hoa:400,discount:3},
      'Chicago':     {homePrice:380000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:2100,rentGrowth:3,propTax:2.1,appreciation:3,investReturn:8,maintenance:1.2,insurance:1800,hoa:200,discount:3},
      'Houston':     {homePrice:310000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:1800,rentGrowth:3,propTax:2.0,appreciation:3,investReturn:8,maintenance:1.2,insurance:2200,hoa:0,  discount:3},
      'Dallas':      {homePrice:340000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:1900,rentGrowth:4,propTax:1.8,appreciation:4,investReturn:8,maintenance:1.2,insurance:2000,hoa:100,discount:3},
      'Miami':       {homePrice:620000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:2800,rentGrowth:5,propTax:0.9,appreciation:5,investReturn:8,maintenance:1.2,insurance:4500,hoa:600,discount:3},
      'Phoenix':     {homePrice:420000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:2000,rentGrowth:5,propTax:0.7,appreciation:5,investReturn:8,maintenance:1.0,insurance:1600,hoa:150,discount:3},
      'Seattle':     {homePrice:780000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:2900,rentGrowth:4,propTax:0.9,appreciation:5,investReturn:8,maintenance:1.0,insurance:1800,hoa:300,discount:3},
      'Austin':      {homePrice:530000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:2200,rentGrowth:5,propTax:1.8,appreciation:5,investReturn:8,maintenance:1.2,insurance:2000,hoa:200,discount:3},
      'Denver':      {homePrice:580000, downPct:20,mortRate:6.8,loanYears:30,monthlyRent:2400,rentGrowth:4,propTax:0.5,appreciation:4,investReturn:8,maintenance:1.0,insurance:1700,hoa:200,discount:3}
    }},
    UK: { label:'UK', currency:'GBP', cities: {
      'London':     {homePrice:600000,downPct:15,mortRate:5.2,loanYears:25,monthlyRent:2800,rentGrowth:4,propTax:1.2,appreciation:4,investReturn:7,maintenance:1.0,insurance:1500,hoa:300,discount:3},
      'Manchester': {homePrice:280000,downPct:15,mortRate:5.2,loanYears:25,monthlyRent:1400,rentGrowth:4,propTax:1.2,appreciation:4,investReturn:7,maintenance:1.0,insurance:800, hoa:100,discount:3},
      'Birmingham': {homePrice:250000,downPct:15,mortRate:5.2,loanYears:25,monthlyRent:1200,rentGrowth:3,propTax:1.2,appreciation:3,investReturn:7,maintenance:1.0,insurance:700, hoa:80, discount:3},
      'Edinburgh':  {homePrice:330000,downPct:15,mortRate:5.2,loanYears:25,monthlyRent:1600,rentGrowth:4,propTax:1.1,appreciation:4,investReturn:7,maintenance:1.0,insurance:900, hoa:120,discount:3},
      'Bristol':    {homePrice:380000,downPct:15,mortRate:5.2,loanYears:25,monthlyRent:1800,rentGrowth:4,propTax:1.2,appreciation:4,investReturn:7,maintenance:1.0,insurance:1000,hoa:150,discount:3}
    }},
    AE: { label:'UAE', currency:'AED', cities: {
      'Dubai':     {homePrice:1800000,downPct:20,mortRate:4.5,loanYears:25,monthlyRent:8000,rentGrowth:5,propTax:0,appreciation:5,investReturn:8,maintenance:1.0,insurance:6000,hoa:2000,discount:3},
      'Abu Dhabi': {homePrice:1500000,downPct:20,mortRate:4.5,loanYears:25,monthlyRent:7000,rentGrowth:4,propTax:0,appreciation:4,investReturn:8,maintenance:1.0,insurance:5000,hoa:1500,discount:3},
      'Sharjah':   {homePrice:700000, downPct:20,mortRate:4.5,loanYears:25,monthlyRent:3500,rentGrowth:4,propTax:0,appreciation:3,investReturn:8,maintenance:1.0,insurance:2500,hoa:800, discount:3}
    }},
    AU: { label:'Australia', currency:'AUD', cities: {
      'Sydney':    {homePrice:1400000,downPct:20,mortRate:6.2,loanYears:30,monthlyRent:3800,rentGrowth:4,propTax:1.0,appreciation:5,investReturn:8,maintenance:1.0,insurance:3000,hoa:500,discount:3},
      'Melbourne': {homePrice:1000000,downPct:20,mortRate:6.2,loanYears:30,monthlyRent:2800,rentGrowth:4,propTax:0.9,appreciation:4,investReturn:8,maintenance:1.0,insurance:2500,hoa:400,discount:3},
      'Brisbane':  {homePrice:780000, downPct:20,mortRate:6.2,loanYears:30,monthlyRent:2400,rentGrowth:5,propTax:0.8,appreciation:5,investReturn:8,maintenance:1.0,insurance:2000,hoa:300,discount:3},
      'Perth':     {homePrice:650000, downPct:20,mortRate:6.2,loanYears:30,monthlyRent:2200,rentGrowth:5,propTax:0.8,appreciation:5,investReturn:8,maintenance:1.0,insurance:1800,hoa:200,discount:3}
    }}
  },
  apply(marketKey, cityName) {
    const market = this.markets[marketKey]; if (!market) return;
    const city   = market.cities[cityName];  if (!city)   return;
    const cur = document.getElementById('currency');
    if (cur) cur.value = market.currency;
    if (typeof previousCurrency !== 'undefined') previousCurrency = market.currency;
    const sliders = {
      downPct:city.downPct, mortRate:city.mortRate, loanYears:city.loanYears,
      rentGrowth:city.rentGrowth, propTax:city.propTax, appreciation:city.appreciation,
      investReturn:city.investReturn, maintenance:city.maintenance, discount:city.discount||3
    };
    Object.entries(sliders).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
    });
    const sym = Forex.getSymbol(market.currency);
    const setMoney = (id, val) => { const el = document.getElementById(id); if (el) el.value = Fmt.number(val); };
    setMoney('homePrice', city.homePrice); setMoney('monthlyRent', city.monthlyRent);
    setMoney('hoa', city.hoa); setMoney('insurance', city.insurance);
    ['sym1','sym2','sym3','sym4','sym5'].forEach(s => { const el = document.getElementById(s); if (el) el.textContent = sym; });
    if (typeof window.recalculate === 'function') window.recalculate();
  }
};

/* ── 6. FINANCIAL FORMULAS ──────────────────────────────────── */
const Finance = {
  pmt(principal, annualRate, years) {
    if (annualRate === 0) return principal / (years * 12);
    const r = annualRate / 100 / 12, n = years * 12;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  },
  fv(presentValue, annualRate, years) { return presentValue * Math.pow(1 + annualRate / 100, years); },
  pv(futureValue, discountRate, years) {
    if (discountRate === 0) return futureValue;
    return futureValue / Math.pow(1 + discountRate / 100, years);
  },
  pvAnnuity(payment, annualRate, years) {
    if (annualRate === 0) return payment * years * 12;
    const r = annualRate / 100 / 12, n = years * 12;
    return payment * (1 - Math.pow(1 + r, -n)) / r;
  },
  npv(rate, cashFlows) {
    return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate / 100, t + 1), 0);
  },
  totalInterest(principal, annualRate, years) {
    return this.pmt(principal, annualRate, years) * years * 12 - principal;
  },
  loanBalance(principal, annualRate, years, monthsPaid) {
    if (annualRate === 0) return principal - (principal / (years * 12)) * monthsPaid;
    const r = annualRate / 100 / 12, n = years * 12;
    if (monthsPaid >= n) return 0;
    return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, monthsPaid)) / (Math.pow(1 + r, n) - 1);
  }
};

/* ── 7. BUY-VS-RENT MONTE CARLO ─────────────────────────────── */
const MonteCarlo = {
  ITERATIONS: 1000,
  SIGMA: { appreciation:2.0, rentGrowth:1.5, investReturn:2.5, maintenance:1.0 },
  randNormal(mean, sd) {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
  run(p) {
    const { homePrice, downPayment, mortRate, loanYears, monthlyRent, rentGrowth,
            appreciation, propTax, maintenance, hoaMonthly, insurance, investReturn, horizon } = p;
    const principal = homePrice - downPayment;
    const mm = Finance.pmt(principal, mortRate, loanYears);
    const results = [];
    for (let i = 0; i < this.ITERATIONS; i++) {
      const aR = this.randNormal(appreciation, this.SIGMA.appreciation);
      const rR = this.randNormal(rentGrowth,   this.SIGMA.rentGrowth);
      const iR = this.randNormal(investReturn,  this.SIGMA.investReturn);
      const mR = this.randNormal(maintenance,   this.SIGMA.maintenance);
      const yBC = [], yRC = [];
      let cr = monthlyRent, cB = 0, cR = 0, inv = downPayment;
      for (let y = 1; y <= horizon; y++) {
        const hv  = Finance.fv(homePrice, aR, y);
        const lb  = y <= loanYears ? Finance.loanBalance(principal, mortRate, loanYears, y * 12) : 0;
        cB += mm * 12 + hv * (propTax / 100) + homePrice * (Math.max(mR, 0) / 100) + insurance + hoaMonthly * 12;
        cR += cr * 12;
        inv = Finance.fv(inv, Math.max(iR, 0), 1);
        yBC.push(cB - (hv - lb));
        yRC.push(cR - inv + downPayment);
        cr *= (1 + Math.max(rR, 0) / 100);
      }
      results.push({ yearlyBuyCost: yBC, yearlyRentCost: yRC });
    }
    const p10 = [], p50 = [], p90 = [], beY = [];
    for (let y = 0; y < horizon; y++) {
      const adv = results.map(r => r.yearlyRentCost[y] - r.yearlyBuyCost[y]);
      adv.sort((a, b) => a - b);
      p10.push(adv[Math.floor(this.ITERATIONS * 0.10)]);
      p50.push(adv[Math.floor(this.ITERATIONS * 0.50)]);
      p90.push(adv[Math.floor(this.ITERATIONS * 0.90)]);
    }
    results.forEach(r => {
      for (let y = 0; y < horizon; y++) {
        if (r.yearlyRentCost[y] - r.yearlyBuyCost[y] > 0) { beY.push(y + 1); break; }
      }
    });
    beY.sort((a, b) => a - b);
    const len = beY.length;
    return { p10, p50, p90, breakEven: {
      be10: len ? (beY[Math.floor(len * 0.10)] || horizon) : horizon,
      be50: len ? (beY[Math.floor(len * 0.50)] || horizon) : horizon,
      be90: len ? (beY[Math.floor(len * 0.90)] || horizon) : horizon
    }};
  }
};

/* ── 8. CHART HELPERS (BVR) ─────────────────────────────────── */
const CalcCharts = {
  defaults: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1A1A2E', padding: 12, titleFont: { family: 'DM Sans', size: 12, weight: '600' }, bodyFont: { family: 'DM Sans', size: 12 }, cornerRadius: 8, borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 }
    },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#9AA3B0', maxTicksLimit: 10 } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#9AA3B0' } }
    }
  },
  makeGradient(ctx, color, a1 = 0.18, a2 = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, 300);
    const h = color.replace('#', '');
    const r = parseInt(h.slice(0,2),16), gr = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    g.addColorStop(0, `rgba(${r},${gr},${b},${a1})`);
    g.addColorStop(1, `rgba(${r},${gr},${b},${a2})`);
    return g;
  },
  formatYAxis(sym) {
    return { callback: val => {
      const abs = Math.abs(val);
      if (abs >= 1e9) return sym + (val/1e9).toFixed(1) + 'B';
      if (abs >= 1e6) return sym + (val/1e6).toFixed(1) + 'M';
      if (abs >= 1e3) return sym + (val/1e3).toFixed(0) + 'K';
      return sym + Fmt.number(val);
    }};
  }
};

/* ── 9. SHARE URL ───────────────────────────────────────────── */
const ShareURL = {
  encode(p) { return btoa(encodeURIComponent(JSON.stringify(p))); },
  decode(h)  { try { return JSON.parse(decodeURIComponent(atob(h))); } catch { return null; } },
  build(p)   { const u = new URL(window.location.href.split('?')[0]); u.searchParams.set('s', this.encode(p)); return u.toString(); },
  read()     { const s = new URLSearchParams(window.location.search).get('s'); return s ? this.decode(s) : null; },
  copyToClipboard(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    return Promise.resolve();
  }
};

/* ── 10. EXPORT HELPERS ─────────────────────────────────────── */
const ExportHelper = {
  copyText(lines) { return ShareURL.copyToClipboard(lines.join('\n')); },
  printPDF()      { window.print(); }
};

/* ── 11. TOOLTIP ENGINE ─────────────────────────────────────── */
const Tooltips = {
  definitions: {
    currency:     'The currency for all inputs and outputs.',
    horizon:      'How many years to run the comparison.',
    discount:     'Inflation adjustment — converts future costs to today\'s money.',
    homePrice:    'The total purchase price of the property.',
    downPct:      'Percentage of home price paid upfront.',
    loanYears:    'How long your mortgage runs.',
    mortRate:     'Annual interest rate on your mortgage.',
    monthlyRent:  'What you\'d pay per month in rent for an equivalent property.',
    rentGrowth:   'How much rent increases each year.',
    propTax:      'Annual property tax as % of home value.',
    maintenance:  'Annual upkeep cost as % of home value.',
    hoa:          'Monthly fees paid to a homeowners association.',
    insurance:    'Annual home insurance premium.',
    investReturn: 'Annual return if down payment were invested instead.',
    appreciation: 'Annual home value growth rate.'
  },
  init() {
    document.querySelectorAll('[data-tip]').forEach(el => {
      const text = this.definitions[el.dataset.tip]; if (!text) return;
      el.addEventListener('mouseenter', e => this.show(e.currentTarget, text));
      el.addEventListener('mouseleave', () => this.hide());
      el.addEventListener('click', e => { e.stopPropagation(); this.show(e.currentTarget, text); });
    });
    document.addEventListener('click', () => this.hide());
  },
  show(anchor, text) {
    this.hide();
    const tip = document.createElement('div');
    tip.className = 'calc-tooltip'; tip.textContent = text;
    document.body.appendChild(tip);
    const rect = anchor.getBoundingClientRect(), tipW = 240;
    let left = rect.left + window.scrollX, top = rect.bottom + window.scrollY + 6;
    if (left + tipW > window.innerWidth - 16) left = window.innerWidth - tipW - 16;
    tip.style.cssText = `left:${left}px;top:${top}px;width:${tipW}px;`;
    requestAnimationFrame(() => tip.classList.add('visible'));
    this._current = tip;
  },
  hide() { if (this._current) { this._current.remove(); this._current = null; } }
};

/* ── 12. ACCORDION ──────────────────────────────────────────── */
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.accordion-section');
      const isOpen  = section.classList.contains('open');
      section.parentElement.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
      if (!isOpen) section.classList.add('open');
    });
  });
}

/* ── 13. DOM UTILITIES ──────────────────────────────────────── */
function $(id)               { return document.getElementById(id); }
function setText(id, val)    { const el = $(id); if (el) el.textContent = val; }
function setHTML(id, val)    { const el = $(id); if (el) el.innerHTML   = val; }
function addClass(id, cls)   { const el = $(id); if (el) el.classList.add(cls); }
function removeClass(id,cls) { const el = $(id); if (el) el.classList.remove(cls); }

/* ── 14. CURRENCY CONFIG (SE + Freelance) ───────────────────── */
const CURRENCIES = {
  USD: { symbol: '$',   locale: 'en-US', code: 'USD' },
  GBP: { symbol: '£',   locale: 'en-GB', code: 'GBP' },
  EUR: { symbol: '€',   locale: 'de-DE', code: 'EUR' },
  AED: { symbol: 'AED', locale: 'ar-AE', code: 'AED' },
  PKR: { symbol: '₨',   locale: 'en-PK', code: 'PKR' }
};

/* ── 15. SE/FREELANCE FORMATTERS ────────────────────────────── */
function fmt(val, currencyCode = 'USD') {
  const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
  try { return new Intl.NumberFormat(c.locale, { style:'currency', currency:c.code, maximumFractionDigits:0 }).format(val); }
  catch { return c.symbol + ' ' + Math.round(val).toLocaleString(); }
}
function fmtShort(val, currencyCode = 'USD') {
  const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const abs = Math.abs(val);
  let str;
  if (abs >= 1e6)      str = (val / 1e6).toFixed(1) + 'M';
  else if (abs >= 1e3) str = (val / 1e3).toFixed(1) + 'K';
  else                 str = Math.round(val).toString();
  return c.symbol + str;
}
function currencySymbol(code) { return (CURRENCIES[code] || CURRENCIES.USD).symbol; }

/* ── 16. RANDOM NUMBER GENERATION ──────────────────────────── */
function randn() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function randNormal(mean, std) { return mean + std * randn(); }

/* ── 17. SALARY EROSION MONTE CARLO ────────────────────────── */
function runSalaryErosion(p) {
  const { monthlySalary, inflationMean, inflationStd, raiseMean, raiseStd,
          raiseFrequency, years, taxRate, otherDeductions, lifestyleInflation, runCount = 5000 } = p;
  const netFactor = 1 - taxRate - otherDeductions;
  const startReal = monthlySalary * netFactor;
  const perYear   = Array.from({ length: years }, () => new Float64Array(runCount));
  for (let r = 0; r < runCount; r++) {
    let nominal = monthlySalary, cpi = 1;
    for (let y = 1; y <= years; y++) {
      if (raiseFrequency > 0 && y % raiseFrequency === 0)
        nominal *= (1 + Math.max(0, randNormal(raiseMean, raiseStd)));
      cpi *= (1 + Math.max(0, randNormal(inflationMean, inflationStd)));
      perYear[y - 1][r] = (nominal / cpi) * netFactor;
    }
  }
  const fanData = perYear.map(arr => {
    const s = arr.slice().sort((a, b) => a - b);
    return { p10:s[Math.floor(0.10*runCount)], p50:s[Math.floor(0.50*runCount)], p90:s[Math.floor(0.90*runCount)] };
  });
  const lifestyleData = []; let lc = startReal;
  for (let y = 1; y <= years; y++) { lc *= (1 + lifestyleInflation); lifestyleData.push(lc); }
  const histogram = perYear[years - 1];
  let keepUp = 0;
  for (let r = 0; r < runCount; r++) { if (histogram[r] >= startReal) keepUp++; }
  function p50AtRaise(tr) {
    const vals = new Float64Array(1000);
    for (let r = 0; r < 1000; r++) {
      let nom = monthlySalary, c2 = 1;
      for (let y = 1; y <= years; y++) {
        if (raiseFrequency > 0 && y % raiseFrequency === 0) nom *= (1 + Math.max(0, randNormal(tr, raiseStd)));
        c2 *= (1 + Math.max(0, randNormal(inflationMean, inflationStd)));
      }
      vals[r] = (nom / c2) * netFactor;
    }
    return vals.slice().sort((a, b) => a - b)[500];
  }
  let lo = 0, hi = 0.5, beRaise = hi;
  for (let i = 0; i < 20; i++) { const mid = (lo+hi)/2; if (p50AtRaise(mid) >= startReal) { beRaise=mid; hi=mid; } else lo=mid; }
  return { fanData, lifestyleData, histogram, startReal, breakEvenRaise: beRaise, probKeepsUp: keepUp / runCount };
}

/* ── 18. SE CHART BUILDERS ──────────────────────────────────── */
const _charts = {};
function destroyChart(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }

const _seOpts = {
  responsive: true, maintainAspectRatio: true, animation: { duration: 500 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#1A1A2E', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, titleColor: '#9AA3B0', bodyColor: '#e8edf5', padding: 10 }
  },
  scales: {
    x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9AA3B0', font: { family: 'DM Mono', size: 10 } } },
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9AA3B0', font: { family: 'DM Mono', size: 10 } } }
  }
};

function buildFanChart(canvasId, data) {
  destroyChart(canvasId);
  const { fanData, lifestyleData, startReal, years, currencyCode } = data;
  const labels = Array.from({ length: years }, (_, i) => `Y${i + 1}`);
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label:'P90',            data:fanData.map(d=>d.p90), borderColor:'rgba(46,125,94,0.8)',  borderWidth:1.5, pointRadius:0, fill:false, tension:0.3 },
      { label:'P50 (median)',   data:fanData.map(d=>d.p50), borderColor:'#0B4F6C',              borderWidth:2.5, pointRadius:0, fill:{ target:'+1', above:'rgba(11,79,108,0.06)' }, tension:0.3 },
      { label:'P10',            data:fanData.map(d=>d.p10), borderColor:'rgba(192,57,43,0.8)', borderWidth:1.5, pointRadius:0, fill:false, tension:0.3 },
      { label:'Lifestyle cost', data:lifestyleData,          borderColor:'#D4881A',             borderWidth:2,   borderDash:[6,4], pointRadius:0, fill:false, tension:0.3 },
      { label:'Starting real',  data:Array(years).fill(startReal), borderColor:'rgba(154,163,176,0.5)', borderWidth:1, borderDash:[3,3], pointRadius:0, fill:false }
    ]},
    options: { ..._seOpts,
      scales: { x:_seOpts.scales.x, y:{ ..._seOpts.scales.y, ticks:{ ..._seOpts.scales.y.ticks, callback: v => fmtShort(v, currencyCode) } } },
      plugins: { ..._seOpts.plugins, tooltip: { ..._seOpts.plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y, currencyCode)}` } } }
    }
  });
}

function buildHistogram(canvasId, data) {
  destroyChart(canvasId);
  const { histogram, startReal, currencyCode, bins = 30 } = data;
  const arr = Array.from(histogram);
  const mn = Math.min(...arr), mx = Math.max(...arr), bw = (mx - mn) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of arr) { const i = Math.min(Math.floor((v-mn)/bw), bins-1); counts[i]++; }
  const labels = counts.map((_, i) => fmtShort(mn + i * bw, currencyCode));
  const colors = counts.map((_, i) => (mn+(i+0.5)*bw) >= startReal ? 'rgba(46,125,94,0.75)' : 'rgba(192,57,43,0.75)');
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label:'Runs', data:counts, backgroundColor:colors, borderColor:colors.map(c=>c.replace('0.75','1')), borderWidth:1, borderRadius:2 }] },
    options: { ..._seOpts,
      plugins: { ..._seOpts.plugins, tooltip: { ..._seOpts.plugins.tooltip, callbacks: { label: ctx => ` ${ctx.parsed.y} runs` } } },
      scales: { x: { grid:{display:false}, ticks:{color:'#9AA3B0',font:{family:'DM Mono',size:9},maxRotation:45} }, y: _seOpts.scales.y }
    }
  });
}

/* ── 19. FREELANCE INCOME MONTE CARLO ───────────────────────── */
const PLATFORM_FEES = { upwork:0.20, fiverr:0.20, guru:0.0895, toptal:0, direct:0, custom:null };

function runFreelancerIncome(p) {
  const { hourlyRate, platformFee, hoursPerWeek, weeksPerMonth, utilizationMean, utilizationStd,
          slowMonthProb, slowMonthFactor, taxRate, selfEmploymentTax, otherDeductions,
          monthlyExpenses, annualExpenses, years, rateGrowthMean, rateGrowthStd, runCount = 5000 } = p;
  const totalMonths = years * 12;
  const taxTotal    = taxRate + selfEmploymentTax + otherDeductions;
  const baseHours   = hoursPerWeek * weeksPerMonth;
  const pmN = Array.from({ length: totalMonths }, () => new Float64Array(runCount));
  const pmG = Array.from({ length: totalMonths }, () => new Float64Array(runCount));
  for (let r = 0; r < runCount; r++) {
    let rate = hourlyRate;
    for (let m = 0; m < totalMonths; m++) {
      if (m > 0 && m % 12 === 0) rate *= (1 + Math.max(0, randNormal(rateGrowthMean, rateGrowthStd)));
      const util    = Math.min(1, Math.max(0, randNormal(utilizationMean, utilizationStd)));
      const gross   = rate * baseHours * util * (Math.random() < slowMonthProb ? slowMonthFactor : 1);
      const platNet = gross * (1 - platformFee);
      pmG[m][r] = gross;
      pmN[m][r] = platNet - platNet * taxTotal - monthlyExpenses - (annualExpenses / 12);
    }
  }
  const monthlyFanData = pmN.map(arr => {
    const s = arr.slice().sort((a,b) => a-b);
    return { p10:s[Math.floor(0.10*runCount)], p50:s[Math.floor(0.50*runCount)], p90:s[Math.floor(0.90*runCount)] };
  });
  const grossFanData = pmG.map(arr => arr.slice().sort((a,b)=>a-b)[Math.floor(0.50*runCount)]);
  const histogram = pmN[totalMonths - 1];
  let pos = 0; for (let r = 0; r < runCount; r++) { if (histogram[r] > 0) pos++; }
  const annualSummary = [];
  for (let y = 0; y < years; y++) {
    let grossSum = 0, netSum = 0;
    for (let m = y*12; m < (y+1)*12; m++) { grossSum += grossFanData[m]; netSum += monthlyFanData[m].p50; }
    const platCut = grossSum * platformFee, platNet = grossSum - platCut;
    const taxAmt  = platNet * taxTotal, expAmt = monthlyExpenses * 12 + annualExpenses;
    const effRate = netSum > 0 ? netSum / (baseHours * 12 * utilizationMean) : 0;
    annualSummary.push({ year:y+1, gross:grossSum, platformCut:platCut, tax:taxAmt, expenses:expAmt, net:netSum, effRate });
  }
  const y1 = annualSummary[0];
  const yr1 = {
    platformCut: y1.platformCut,
    incomeTax:   y1.gross * (1-platformFee) * taxRate,
    seTax:       y1.gross * (1-platformFee) * selfEmploymentTax,
    otherDed:    y1.gross * (1-platformFee) * otherDeductions,
    expenses:    y1.expenses,
    takeHome:    Math.max(0, y1.net)
  };
  return { monthlyFanData, grossFanData, histogram, annualSummary, probPositive: pos/runCount, yr1 };
}

/* ── 20. FREELANCE CHART BUILDERS ───────────────────────────── */
function buildMonthlyFanChart(canvasId, data) {
  destroyChart(canvasId);
  const { monthlyFanData, grossFanData, years, currencyCode } = data;
  const totalMonths = years * 12;
  const labels = Array.from({ length: totalMonths }, (_, i) => i % 3 === 0 ? `M${i+1}` : '');
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label:'P90',      data:monthlyFanData.map(d=>d.p90), borderColor:'rgba(46,125,94,0.8)',  borderWidth:1.5, pointRadius:0, fill:false, tension:0.3 },
      { label:'P50 Net',  data:monthlyFanData.map(d=>d.p50), borderColor:'#0B4F6C',              borderWidth:2.5, pointRadius:0, fill:{ target:'+1', above:'rgba(11,79,108,0.06)' }, tension:0.3 },
      { label:'P10',      data:monthlyFanData.map(d=>d.p10), borderColor:'rgba(192,57,43,0.8)', borderWidth:1.5, pointRadius:0, fill:false, tension:0.3 },
      { label:'P50 Gross',data:grossFanData,                  borderColor:'#D4881A',             borderWidth:1.5, borderDash:[6,4], pointRadius:0, fill:false, tension:0.3 }
    ]},
    options: { ..._seOpts,
      scales: { x:_seOpts.scales.x, y:{ ..._seOpts.scales.y, ticks:{ ..._seOpts.scales.y.ticks, callback: v => fmtShort(v, currencyCode) } } },
      plugins: { ..._seOpts.plugins, tooltip: { ..._seOpts.plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y, currencyCode)}` } } }
    }
  });
}

function buildDonutChart(canvasId, data) {
  destroyChart(canvasId);
  const { yr1, currencyCode } = data;
  const labels = ['Platform Fees','Income Tax','Self-Employ. Tax','Other Deductions','Expenses','Take-Home'];
  const values = [yr1.platformCut, yr1.incomeTax, yr1.seTax, yr1.otherDed, yr1.expenses, yr1.takeHome];
  const colors = ['#C0392B','#D4881A','#F4845F','#9AA3B0','#5A6478','#2E7D5E'];
  const ctx = document.getElementById(canvasId).getContext('2d');
  _charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data:values, backgroundColor:colors.map(c=>c+'cc'), borderColor:colors, borderWidth:2, hoverOffset:8 }] },
    options: { responsive:true, maintainAspectRatio:true, cutout:'62%', animation:{duration:500},
      plugins: { legend:{display:false}, tooltip:{ backgroundColor:'#1A1A2E', borderColor:'rgba(255,255,255,0.08)', borderWidth:1, titleColor:'#9AA3B0', bodyColor:'#e8edf5',
        callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed, currencyCode)}` } } }
    }
  });
}

/* ── 21. BINDERS (SE + Freelance) ───────────────────────────── */
function bindSlider(sliderId, displayId, transform) {
  const slider  = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  const fn = transform || (v => v);
  const update = () => { display.textContent = fn(slider.value); };
  slider.addEventListener('input', update);
  update();
}

function bindCurrencySelect(selectId, prefixId, onChange) {
  const sel    = document.getElementById(selectId);
  const prefix = document.getElementById(prefixId);
  if (!sel || !prefix) return;
  const update = () => { prefix.textContent = currencySymbol(sel.value); if (onChange) onChange(sel.value); };
  sel.addEventListener('change', update);
  update();
}

function commaInput(el) {
  function format() {
    const raw = el.value.replace(/[^0-9]/g, '');
    if (raw === '') { el.value = ''; return; }
    el.value = parseInt(raw, 10).toLocaleString('en-US');
  }
  el.addEventListener('input', format);
  if (el.value) { const raw = el.value.replace(/[^0-9]/g,''); if (raw) el.value = parseInt(raw,10).toLocaleString('en-US'); }
}

function parseComma(str) { return parseFloat(str.replace(/,/g, '')) || 0; }

/* ── 22. PLATFORM_FEES already defined in section 19 ─────────── */

/* ── 23. GLOBAL INIT ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initCommaInputs();
  initSliders();
  Tooltips.init();
});