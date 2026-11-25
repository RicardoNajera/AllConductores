/* =====================================================================
   All Conductor — app.js
   PWA mobile-first de mototaxis (flujo completo conductor).
   Sin backend: toda la simulación de matching, tracking y chat es local.
   ===================================================================== */
'use strict';

/* ------------------------------ Config ------------------------------ */
const APP = {
  center: { lat: 21.1743, lng: -86.8466 },        // Cancún, Q. Roo
  baseFare: 20,                                    // $20 MXN base
  minFare: 20,
  maxFare: 40,
  perKm: 6,
  vehicleSpeedKmh: 26,                             // promedio urbano mototaxi
  driverArriveMs: 12000,
  rideDurationMs: 24000,
  alertSeconds: 15,
  storageKey: 'allconductor-v1'
};

/* --------------------------- Lugares Cancún -------------------------- */
const PLACES = [
  { id: 'centro', name: 'Cancún Centro', area: 'SM 22 · Av. Yaxchilán', lat: 21.1613, lng: -86.8515, icon: 'landmark' },
  { id: 'mercado28', name: 'Mercado 28', area: 'SM 28 · Av. Xel-Há', lat: 21.1666, lng: -86.8302, icon: 'store' },
  { id: 'plaza_americas', name: 'Plaza Las Américas', area: 'SM 3 · Av. Bonampak', lat: 21.1487, lng: -86.8243, icon: 'shopping-bag' },
  { id: 'chedraui_lakin', name: "Chedraui Lak'in", area: "SM 3 · Av. Lak'in", lat: 21.1553, lng: -86.8248, icon: 'shopping-cart' },
  { id: 'kabah', name: 'Av. Kabah', area: 'SM 44 · Kabah y Xpuhil', lat: 21.1476, lng: -86.8429, icon: 'route' },
  { id: 'prado_norte', name: 'Prado Norte', area: 'SM 260 · Prado Norte', lat: 21.1618, lng: -86.8719, icon: 'home' },
  { id: 'region259', name: 'Región 259', area: 'SM 259 · Andrés Quintana Roo', lat: 21.1741, lng: -86.8618, icon: 'map-pin' },
  { id: 'villas_otoch', name: 'Villas Otoch Paraíso', area: 'SM 313 · Paraíso', lat: 21.1661, lng: -86.8822, icon: 'building-2' },
  { id: 'parque_kabah', name: 'Parque Urbano Kabah', area: 'SM 46 · Av. Kabah', lat: 21.1402, lng: -86.8452, icon: 'trees' },
  { id: 'coba', name: 'Crucero Av. Cobá', area: 'SM 22 · Av. Cobá', lat: 21.1573, lng: -86.8396, icon: 'traffic-cone' },
  { id: 'torre_sur', name: 'Torre Sur Cancún', area: 'SM 22 · Malecón', lat: 21.1589, lng: -86.8181, icon: 'building' },
  { id: 'hospital', name: 'Hospital General Cancún', area: 'SM 30 · Av. Nader', lat: 21.1592, lng: -86.8437, icon: 'cross' },
  { id: 'costco', name: 'Costco Kabah', area: 'SM 21 · Av. Kabah', lat: 21.1631, lng: -86.8234, icon: 'shopping-basket' },
  { id: 'puerto_juarez', name: 'Puerto Juárez', area: 'Zona Hotelera Norte', lat: 21.1929, lng: -86.8052, icon: 'ship' },
  { id: 'las_palapas', name: 'Parque Las Palapas', area: 'SM 22 · Centro', lat: 21.1634, lng: -86.8278, icon: 'party-popper' }
];

const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/* ------------------------- Conductores demo -------------------------- */
const DRIVERS = [
  { name: 'Julián López', unit: '#048', plate: 'UCR-4821', vehicle: 'Italika FT150 · Blanco', rating: 4.9, phone: '998 123 4567', initials: 'JL' },
  { name: 'Marco Canul', unit: '#112', plate: 'UCR-1930', vehicle: 'Honda Cargo 150 · Rojo', rating: 4.8, phone: '998 554 2210', initials: 'MC' },
  { name: 'Ernesto Dzib', unit: '#076', plate: 'UCD-7734', vehicle: 'Italika DM200 · Negro', rating: 5.0, phone: '998 771 0099', initials: 'ED' },
  { name: 'Rocío Pat', unit: '#203', plate: 'UCR-6612', vehicle: 'Vento Titan · Azul', rating: 4.9, phone: '998 220 4471', initials: 'RP' }
];

/* -------------------------------- Estado ----------------------------- */
const state = {
  role: 'passenger',                 // 'passenger' | 'driver'
  phase: 'plan',                     // plan | searching | assigned | riding | finished
  origin: { id: 'me', name: 'Mi ubicación · Cancún Centro', area: 'Zona centro', lat: APP.center.lat, lng: APP.center.lng },
  dest: null,
  quote: null,
  payMethod: 'Efectivo',
  driver: DRIVERS[0],
  rating: 0,
  driverOnline: true,
  alertOpen: false,
  pendingRequest: null,
  driverServiceStep: 'idle',         // idle | toPickup | arrived | toDropoff
  pickerMode: 'dest',
  stats: { earnings: 385, trips: 14, history: [], onlineMs: 4 * 3600 + 12 * 60 }
};

/* ------------------------------ Utilidades --------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmtMoney = (n) => `$${Math.round(n)}`;
const fmtKm = (n) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`);
const fmtMin = (n) => `${Math.max(1, Math.round(n))} min`;
const timeNow = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const lerpPoint = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

/* Trazo vial simulado: la ruta se curva ligeramente como si tomara calles */
function routePoints(a, b, steps = 22) {
  const mid = lerpPoint(a, b, 0.5);
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const norm = Math.hypot(dx, dy) || 1;
  const bend = clamp(haversine(a, b) * 0.012, 0.0003, 0.0022);
  const ctrl = { lat: mid.lat - (dx / norm) * bend, lng: mid.lng + (dy / norm) * bend };
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      lat: (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * ctrl.lat + t ** 2 * b.lat,
      lng: (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * ctrl.lng + t ** 2 * b.lng
    });
  }
  return pts;
}

/* Tarifa fija económica $20–$40 MXN */
function calcFare(km) {
  const rounded = Math.round((APP.baseFare + km * APP.perKm) / 5) * 5;
  return clamp(rounded, APP.minFare, APP.maxFare);
}

function computeQuote(a, b) {
  const km = haversine(a, b) * 1.22;                // ajuste por trazo vial
  const rideMin = (km / APP.vehicleSpeedKmh) * 60 + 2;
  const pickupMin = clamp(Math.round(km * 0.7) + 2, 2, 6);
  return {
    km: Math.round(km * 10) / 10,
    rideMin: Math.max(3, Math.round(rideMin)),
    pickupMin,
    fare: calcFare(km)
  };
}

/* ------------------------------- Toasts ------------------------------ */
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ nameAttr: 'data-lucide', attrs: { 'stroke-width': 2 } });
  }
}

function toast(message, icon = 'info') {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 text-mint shrink-0"></i><span>${message}</span>`;
  wrap.appendChild(el);
  refreshIcons();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

/* ------------------------- Web Audio (sonidos) ----------------------- */
const Sound = (() => {
  let ctx = null;

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function tone(freq, offset, dur, type = 'sine', gain = 0.16, endFreq = null) {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + offset;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  return {
    unlock: () => ensure(),
    alert: () => {                                   // timbre de "nuevo viaje"
      tone(880, 0, 0.16, 'triangle', 0.18);
      tone(1174, 0.18, 0.16, 'triangle', 0.18);
      tone(880, 0.36, 0.16, 'triangle', 0.18);
      tone(1568, 0.56, 0.24, 'sine', 0.12);
    },
    message: () => {
      tone(680, 0, 0.09, 'sine', 0.09);
      tone(990, 0.1, 0.1, 'sine', 0.07);
    },
    success: () => {
      tone(523, 0, 0.12, 'sine', 0.13);
      tone(659, 0.11, 0.12, 'sine', 0.13);
      tone(784, 0.22, 0.22, 'sine', 0.13);
    },
    tap: () => tone(300, 0, 0.05, 'square', 0.04)
  };
})();


/* =============================== MAPA ================================ */
const MapCtl = (() => {
  let map = null;
  let originMarker = null;
  let destMarker = null;
  let routeLine = null;
  let routeGlow = null;
  let assignedMoto = null;
  let ambientMotos = [];
  let ambientTimer = null;
  let trackTimer = null;

  const bikeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h4l1.5 4M5.5 17.5 9 9h5l4.5 8.5M9 9h4"/></svg>`;
  const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>`;

  function init() {
    map = L.map('map', {
      center: [APP.center.lat, APP.center.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 11,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.on('click', (e) => handleMapClick(e.latlng));

    drawOrigin();
    spawnAmbient();
    ambientTimer = setInterval(() => spawnAmbient(), 9000);
    return map;
  }

  function offsetAround(lat, lng, km) {
    const ang = Math.random() * Math.PI * 2;
    const dLat = (km / 111) * Math.cos(ang);
    const dLng = (km / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(ang);
    return { lat: lat + dLat, lng: lng + dLng };
  }

  function motoIcon(assigned = false) {
    return L.divIcon({
      className: 'pin-wrap',
      html: `<div class="moto-marker ${assigned ? 'is-assigned' : ''}"><div class="badge">${bikeSvg}</div></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
  }

  /* Motos disponibles circulando cerca del usuario */
  function spawnAmbient() {
    if (!map || state.role !== 'passenger' || state.phase !== 'plan') return;
    if (ambientMotos.length >= 6) return;

    const p = offsetAround(state.origin.lat, state.origin.lng, 0.6 + Math.random() * 1.8);
    const marker = L.marker([p.lat, p.lng], { icon: motoIcon(false), keyboard: false, interactive: false }).addTo(map);

    const entity = {
      marker,
      lat: p.lat,
      lng: p.lng,
      bearing: Math.random() * Math.PI * 2,
      speed: 0.00006 + Math.random() * 0.00006,
      life: 0,
      moveTimer: null
    };

    entity.moveTimer = setInterval(() => {
      entity.life += 1;
      entity.lat += Math.cos(entity.bearing) * entity.speed;
      entity.lng += Math.sin(entity.bearing) * entity.speed;
      entity.bearing += (Math.random() - 0.5) * 0.55;
      marker.setLatLng([entity.lat, entity.lng]);
      if (entity.life > 34) removeAmbient(entity);
    }, 1200);

    ambientMotos.push(entity);
  }

  function removeAmbient(entity) {
    clearInterval(entity.moveTimer);
    if (map) map.removeLayer(entity.marker);
    ambientMotos = ambientMotos.filter((m) => m !== entity);
  }

  function clearAmbient() {
    ambientMotos.slice().forEach(removeAmbient);
  }

  function drawOrigin() {
    if (!map) return;
    if (originMarker) map.removeLayer(originMarker);
    originMarker = L.marker([state.origin.lat, state.origin.lng], {
      icon: L.divIcon({ className: 'pin-wrap', html: '<div class="origin-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      interactive: false,
      zIndexOffset: 400
    }).addTo(map);
  }

  function drawDestination(place) {
    if (!map) return;
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
    if (!place) return;
    destMarker = L.marker([place.lat, place.lng], {
      icon: L.divIcon({ className: 'pin-wrap', html: `<div class="pin-drop is-dest">${pinSvg}</div>`, iconSize: [42, 42], iconAnchor: [21, 40] }),
      interactive: false,
      zIndexOffset: 500
    }).addTo(map);
  }

  function drawRoute(a, b) {
    clearRoute();
    if (!map || !a || !b) return;
    const pts = routePoints(a, b, 26).map((p) => [p.lat, p.lng]);
    routeGlow = L.polyline(pts, { color: '#16e0a3', weight: 13, opacity: 0.16, lineCap: 'round' }).addTo(map);
    routeLine = L.polyline(pts, { color: '#16e0a3', weight: 5, opacity: 0.95, lineCap: 'round' }).addTo(map);
  }

  function clearRoute() {
    if (!map) return;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (routeGlow) { map.removeLayer(routeGlow); routeGlow = null; }
  }

  function fitPoints(points, options = {}) {
    if (!map || !points || points.length < 1) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], options.zoom || 15, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: options.padding || [70, 70], maxZoom: 16, animate: true, duration: 0.7 });
  }

  function focusOrigin() {
    if (!map) return;
    map.setView([state.origin.lat, state.origin.lng], 15, { animate: true });
  }

  function setAssignedMoto(point, assigned = true) {
    if (!map) return;
    if (!assignedMoto) {
      assignedMoto = L.marker([point.lat, point.lng], {
        icon: motoIcon(assigned), zIndexOffset: 800, interactive: false
      }).addTo(map);
    } else {
      assignedMoto.setIcon(motoIcon(assigned));
      assignedMoto.setLatLng([point.lat, point.lng]);
    }
  }

  function removeAssignedMoto() {
    if (trackTimer) { clearTimeout(trackTimer); trackTimer = null; }
    if (assignedMoto && map) { map.removeLayer(assignedMoto); assignedMoto = null; }
  }

  /* Anima una unidad por la ruta; onProgress recibe 0..1 */
  function animateAlong(a, b, durationMs, onProgress, onDone) {
    const pts = routePoints(a, b, 40);
    const started = performance.now();
    setAssignedMoto(pts[0], true);

    function step() {
      const t = clamp((performance.now() - started) / durationMs, 0, 1);
      const idx = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
      setAssignedMoto(pts[idx], true);
      if (onProgress) onProgress(t);
      if (t < 1) {
        trackTimer = setTimeout(step, 60);
      } else if (onDone) {
        onDone();
      }
    }

    step();
  }

  function invalidate() { if (map) setTimeout(() => map.invalidateSize(), 80); }

  return {
    init, invalidate, drawOrigin, drawDestination, drawRoute, clearRoute, clearAmbient, spawnAmbient,
    fitPoints, focusOrigin, animateAlong, removeAssignedMoto, setAssignedMoto,
    get map() { return map; }
  };
})();

/* ============================ RENDER: LUGARES ======================== */
function placeRowHtml(place, action) {
  return `
    <button type="button" class="place-row" data-place="${place.id}" data-action="${action}">
      <span class="ico"><i data-lucide="${place.icon || 'map-pin'}"></i></span>
      <span class="txt"><b>${place.name}</b><small>${place.area || ''}</small></span>
      <span class="go">${action === 'origin' ? 'Origen' : 'Ir'}</span>
    </button>`;
}

function renderQuickPlaces() {
  const wrap = $('#quickPlaces');
  if (!wrap) return;
  const picks = ['mercado28', 'kabah', 'plaza_americas', 'chedraui_lakin', 'region259', 'prado_norte', 'villas_otoch', 'las_palapas'];
  wrap.innerHTML = picks
    .map((id) => PLACE_BY_ID[id])
    .filter(Boolean)
    .map(
      (p) => `<button type="button" class="quick-place" data-quick="${p.id}">
        <span class="ico"><i data-lucide="${p.icon}"></i></span>
        <span class="lbl">${p.name}</span>
      </button>`
    )
    .join('');
  refreshIcons();
}

function filterPlaces(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return PLACES.slice();
  return PLACES.filter((p) => `${p.name} ${p.area}`.toLowerCase().includes(q));
}

function renderSearchResults(query) {
  const box = $('#searchResults');
  if (!box) return;
  const results = filterPlaces(query).slice(0, 6);
  box.innerHTML = results.length
    ? results.map((p) => placeRowHtml(p, 'dest')).join('')
    : '<p class="text-[11px] text-slate-500 px-1 py-2">Sin resultados. Toca el mapa para fijar el destino.</p>';
  refreshIcons();
}

/* ============================ RENDER: VISTAS ========================= */
let currentAlertTimer = null;

function setView(id) {
  ['viewPassenger', 'viewSearching', 'viewRide', 'viewFinished', 'viewDriver'].forEach((v) => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
  const body = $('#sheetBody');
  if (body) body.scrollTop = 0;
  MapCtl.invalidate();
  refreshIcons();
}

function setRadar(on) {
  const radar = $('#radar');
  if (!radar) return;
  radar.classList.toggle('hidden', !on);
}

function renderQuote() {
  const box = $('#quoteBox');
  const confirm = $('#confirmBtn');
  const label = $('#confirmBtnLabel');
  const destLabel = $('#destLabel');

  if (!state.dest) {
    box?.classList.add('hidden');
    if (confirm) confirm.disabled = true;
    if (label) label.textContent = 'Elige tu destino';
    if (destLabel) {
      destLabel.textContent = 'Toca el mapa o elige un punto';
      destLabel.classList.add('text-slate-400');
    }
    return;
  }

  state.quote = computeQuote(state.origin, state.dest);
  const q = state.quote;

  box?.classList.remove('hidden');
  if (destLabel) {
    destLabel.textContent = state.dest.name;
    destLabel.classList.remove('text-slate-400');
  }
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('quotePrice', fmtMoney(q.fare));
  set('quoteDist', fmtKm(q.km));
  set('quoteEta', fmtMin(q.pickupMin));
  set('quoteTime', fmtMin(q.rideMin));

  if (confirm) confirm.disabled = false;
  if (label) label.textContent = `Pedir viaje · ${fmtMoney(q.fare)} MXN`;

  MapCtl.drawDestination(state.dest);
  MapCtl.drawRoute(state.origin, state.dest);
  MapCtl.fitPoints([state.origin, state.dest]);
  refreshIcons();
}

function renderPayMethod() {
  $$('[data-pay]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.pay === state.payMethod);
  });
}

function setOrigin(place) {
  state.origin = place;
  const lbl = $('#originLabel');
  if (lbl) lbl.textContent = place.name;
  MapCtl.drawOrigin();
  renderQuote();
}

function setDestination(place) {
  state.dest = place;
  renderQuote();
}

/* ========================== FLUJO: CONDUCTOR =========================== */
function startSearch() {
  if (!state.dest) return;
  Sound.unlock();
  Sound.tap();
  state.phase = 'searching';

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('searchingDest', state.dest.name);
  set('searchingPrice', `${fmtMoney(state.quote.fare)} MXN`);

  setView('viewSearching');
  setRadar(true);
  $('#sheet')?.classList.add('is-collapsed');
  MapCtl.clearAmbient();
  MapCtl.invalidate();

  const subs = ['Conectando con unidades cercanas', '3 unidades vistas en la zona', 'Confirmando disponibilidad…'];
  let i = 0;
  const subTimer = setInterval(() => {
    i = (i + 1) % subs.length;
    set('searchingSub', subs[i]);
  }, 1300);

  setTimeout(() => {
    clearInterval(subTimer);
    if (state.phase !== 'searching') return;
    assignDriver();
  }, 4200);
}

function pickDriver() {
  const pool = DRIVERS.filter((d) => d.unit !== (state.driver && state.driver.unit));
  return pool[Math.floor(Math.random() * pool.length)] || DRIVERS[0];
}

function assignDriver() {
  state.phase = 'assigned';
  state.driver = pickDriver();
  const d = state.driver;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('driverName', d.name);
  set('driverRating', d.rating.toFixed(1));
  set('driverVehicle', d.vehicle);
  set('driverUnit', d.unit);
  set('driverPlate', d.plate);
  set('driverAvatar', d.initials);
  set('ridePrice', fmtMoney(state.quote.fare));
  set('rideOrigin', state.origin.name);
  set('rideDest', state.dest.name);
  set('rideStatusLabel', 'Tu mototaxi está en camino');
  set('rideEta', `Llega en ${fmtMin(state.quote.pickupMin)}`);
  set('rideProgressLabel', 'En camino a tu ubicación');
  set('rideProgressPct', '0%');
  set('chatName', d.name);
  set('chatAvatar', d.initials);
  set('chatUnit', d.unit);
  set('safetyUnit', d.unit);
  set('safetyPlate', d.plate);
  const bar = $('#rideProgressBar');
  if (bar) bar.style.width = '0%';

  setView('viewRide');
  setRadar(false);
  Sound.success();
  toast(`${d.name} · ${d.unit} aceptó tu viaje`, 'check-circle-2');

  const startPoint = offsetAroundPoint(state.origin, 0.9);
  MapCtl.drawRoute(startPoint, state.origin);
  MapCtl.fitPoints([startPoint, state.origin, state.dest], { padding: [70, 110] });

  const mins = state.quote.pickupMin;
  MapCtl.animateAlong(startPoint, state.origin, APP.driverArriveMs, (t) => {
    set('rideProgressPct', `${Math.round(t * 100)}%`);
    if (bar) bar.style.width = `${t * 100}%`;
    const remaining = Math.max(1, Math.ceil(mins * (1 - t)));
    set('rideEta', t < 1 ? `Llega en ${fmtMin(remaining)}` : 'Llegó a tu ubicación');
  }, () => {
    startRide();
  });
}

function offsetAroundPoint(p, km) {
  const ang = Math.random() * Math.PI * 2;
  return {
    lat: p.lat + (km / 111) * Math.cos(ang),
    lng: p.lng + (km / (111 * Math.cos((p.lat * Math.PI) / 180))) * Math.sin(ang)
  };
}

function startRide() {
  state.phase = 'riding';
  const q = state.quote;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('rideStatusLabel', 'En viaje a tu destino');
  set('rideEta', `Llegas en ${fmtMin(q.rideMin)}`);
  set('rideProgressLabel', 'Avanzando hacia el destino');
  set('rideProgressPct', '0%');
  const bar = $('#rideProgressBar');
  if (bar) bar.style.width = '0%';
  Sound.message();
  toast('Arrancamos. ¡Buen viaje!', 'navigation');

  MapCtl.drawRoute(state.origin, state.dest);
  MapCtl.fitPoints([state.origin, state.dest], { padding: [70, 110] });

  MapCtl.animateAlong(state.origin, state.dest, APP.rideDurationMs, (t) => {
    set('rideProgressPct', `${Math.round(t * 100)}%`);
    if (bar) bar.style.width = `${t * 100}%`;
    const remaining = Math.max(1, Math.ceil(q.rideMin * (1 - t)));
    set('rideEta', `Llegas en ${fmtMin(remaining)}`);
  }, () => {
    finishRide();
  });
}

function finishRide() {
  state.phase = 'finished';
  state.rating = 0;
  const q = state.quote;
  const d = state.driver;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('endPrice', fmtMoney(q.fare));
  set('endDistance', q.km.toFixed(1));
  set('endDuration', q.rideMin);
  set('endPay', state.payMethod);
  set('endAvatar', d.initials);
  set('endDriver', `${d.name} · ${d.unit}`);
  set('endTime', timeNow());

  $$('#starPicker button').forEach((b) => b.classList.remove('on'));
  const rateBtn = $('#rateBtn');
  if (rateBtn) rateBtn.disabled = true;

  setView('viewFinished');
  setRadar(false);
  Sound.success();
  MapCtl.clearRoute();
  MapCtl.fitPoints([state.origin, state.dest], { padding: [70, 120] });
}

function resetPassengerFlow() {
  state.phase = 'plan';
  state.dest = null;
  state.quote = null;
  state.rating = 0;
  setRadar(false);
  MapCtl.removeAssignedMoto();
  MapCtl.clearRoute();
  MapCtl.drawDestination(null);
  MapCtl.focusOrigin();
  MapCtl.spawnAmbient();
  $('#sheet')?.classList.remove('is-collapsed');
  const lbl = $('#destLabel');
  if (lbl) { lbl.textContent = 'Toca el mapa o elige un punto'; lbl.classList.add('text-slate-400'); }
  renderQuote();
  setView('viewPassenger');
  refreshIcons();
}

function cancelPassengerFlow(message = 'Solicitud cancelada') {
  toast(message, 'x-circle');
  resetPassengerFlow();
}

/* ================================ CHAT =============================== */
const QUICK_REPLIES = [
  'Ya estoy en la esquina',
  '¿Dónde estás exactamente?',
  'Llevo casco, ¿tienes extra?',
  'Espérame 2 minutos',
  'Voy con una mochila pequeña',
  'Gracias, aquí te espero'
];

const DRIVER_REPLIES = {
  'ya estoy en la esquina': ['Voy llegando, espero en la esquina 👍', 'Perfecto, ya te veo. Estoy en la esquina.'],
  '¿dónde estás exactamente?': ['Estoy a media cuadra, frente a la farmacia. Llevo casco extra.'],
  'llevo casco, ¿tienes extra?': ['Sí, cargo un casco extra limpio. Sin problema.'],
  'espérame 2 minutos': ['Claro, te espero. Sin prisa.', 'Va, aquí te espero.'],
  'voy con una mochila pequeña': ['Sin problema, cabe bien en la unidad.'],
  'gracias, aquí te espero': ['Va, nos vemos en un momento 🙌']
};

function openChat() {
  $('#chatOverlay')?.classList.add('is-open');
  Sound.tap();
  if (!$('#chatScroll').dataset.started) {
    $('#chatScroll').dataset.started = '1';
    addBubble('them', `Hola 👋 Soy ${state.driver.name}, unidad ${state.driver.unit}. Ya voy en camino.`, false);
  }
  renderQuickReplies();
  setTimeout(() => { $('#chatInput')?.focus(); }, 260);
}

function closeChat() {
  $('#chatOverlay')?.classList.remove('is-open');
}

function renderQuickReplies() {
  const wrap = $('#quickReplies');
  if (!wrap) return;
  wrap.innerHTML = QUICK_REPLIES.map(
    (r) => `<button type="button" class="chip !py-1.5 !px-2.5 !text-[10.5px]" data-quick-reply="${r}">${r}</button>`
  ).join('');
}

function addBubble(who, text, playSound = true) {
  const scroll = $('#chatScroll');
  if (!scroll) return;
  const el = document.createElement('div');
  el.className = `bubble ${who}`;
  el.innerHTML = `${text}<span class="meta">${timeNow()}</span>`;
  scroll.appendChild(el);
  scroll.scrollTop = scroll.scrollHeight;
  if (playSound && who === 'them') Sound.message();
}

function showTyping() {
  const scroll = $('#chatScroll');
  const el = document.createElement('div');
  el.className = 'bubble them typing';
  el.id = 'typingBubble';
  el.innerHTML = '<span></span><span></span><span></span>';
  scroll.appendChild(el);
  scroll.scrollTop = scroll.scrollHeight;
}

function hideTyping() {
  document.getElementById('typingBubble')?.remove();
}

function driverAutoReply(userText) {
  const key = Object.keys(DRIVER_REPLIES).find((k) => userText.toLowerCase().includes(k.replace('¿', '').replace('?', '')));
  const pool = key ? DRIVER_REPLIES[key] : [
    'Entendido, voy en camino 🏍️',
    'Claro que sí. Ya casi llego.',
    'Perfecto, cualquier cosa me dices por aquí.'
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function sendChatMessage(text) {
  const msg = (text || '').trim();
  if (!msg) return;
  addBubble('me', msg, false);
  const input = $('#chatInput');
  if (input) input.value = '';
  Sound.tap();

  setTimeout(() => showTyping(), 420);
  setTimeout(() => {
    hideTyping();
    addBubble('them', driverAutoReply(msg));
  }, 1600);
}

/* ============================== CONDUCTOR ============================ */
const RING_LEN = 2 * Math.PI * 19;   // radio 19 → longitud del anillo

function fmtOnlineTime(ms) {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function renderDriverStats() {
  const { earnings, trips, onlineMs } = state.stats;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dayEarnings', Math.round(earnings));
  set('dayTrips', trips);
  set('onlineTime', fmtOnlineTime(onlineMs));
  set('dayAvg', `Prom. $${(earnings / Math.max(1, trips)).toFixed(1)}`);
  set('goalPct', `${Math.min(100, Math.round((earnings / 600) * 100))}%`);
  set('driverHeaderSub', `Unidad ${state.driver.unit} · Cancún`);
}

function renderDriverHistory() {
  const box = $('#driverHistory');
  if (!box) return;
  if (!state.stats.history.length) {
    box.innerHTML = '<p class="hist-empty">Sin viajes todavía. Presiona “Recibir viaje” para simular una solicitud.</p>';
    return;
  }
  box.innerHTML = state.stats.history
    .slice(0, 8)
    .map(
      (h) => `<div class="hist-row">
        <span class="dot ${h.kind === 'rejected' ? 'red' : ''}"></span>
        <div class="flex-1 min-w-0">
          <p class="text-[11.5px] font-bold text-white truncate">${h.label}</p>
          <p class="text-[10px] text-slate-400 truncate">${h.detail}</p>
        </div>
        <span class="text-[10.5px] font-bold ${h.kind === 'rejected' ? 'text-rose-300' : 'text-mint'} shrink-0">${h.amount}</span>
      </div>`
    )
    .join('');
}

function setOnline(online, opts = {}) {
  const silent = opts.silent === true;
  state.driverOnline = online;
  const btn = $('#onlineToggle');
  const label = $('#onlineLabel');
  const dot = $('#onlineDot');
  if (!btn) return;

  btn.setAttribute('aria-pressed', String(online));
  if (label) {
    label.textContent = online ? 'Conectado' : 'Desconectado';
    label.style.color = online ? '#16e0a3' : '#94a3b8';
  }
  btn.style.background = online ? 'rgba(22,224,163,.10)' : 'rgba(255,255,255,.05)';
  btn.style.borderColor = online ? 'rgba(22,224,163,.35)' : 'rgba(255,255,255,.14)';
  if (dot) dot.style.background = online ? '#16e0a3' : '#94a3b8';

  const box = $('#driverStateBox');
  const title = $('#driverStateTitle');
  const sub = $('#driverStateSub');
  if (box && !state.pendingRequest && state.driverServiceStep === 'idle') {
    box.style.background = online ? 'rgba(22,224,163,.08)' : 'rgba(148,163,184,.08)';
    box.style.borderColor = online ? 'rgba(22,224,163,.28)' : 'rgba(148,163,184,.28)';
    if (title) title.textContent = online ? 'Esperando solicitudes' : 'Estás desconectado';
    if (sub) sub.textContent = online ? 'Cerca de Mercado 28 · Zona centro' : 'Actívate para recibir viajes';
  }

  if (silent) return;

  if (!online) {
    closeTripAlert(true);
    toast('Te desconectaste de la plataforma', 'wifi-off');
  } else {
    toast('Ya estás en línea, recibirás viajes', 'wifi');
  }
}

function buildDemoRequest() {
  const origin = PLACES[Math.floor(Math.random() * PLACES.length)];
  let dest = PLACES[Math.floor(Math.random() * PLACES.length)];
  let guard = 0;
  while (dest.id === origin.id && guard++ < 12) {
    dest = PLACES[Math.floor(Math.random() * PLACES.length)];
  }
  return {
    origin: { id: origin.id, name: origin.name, area: origin.area, lat: origin.lat, lng: origin.lng },
    dest: { id: dest.id, name: dest.name, area: dest.area, lat: dest.lat, lng: dest.lng },
    quote: computeQuote(origin, dest),
    pickupKm: Math.round((0.25 + Math.random() * 1.1) * 10) / 10,
    passenger: ['Ana', 'Luis', 'Karla', 'Diego', 'Mari'][Math.floor(Math.random() * 5)],
    createdAt: Date.now()
  };
}

function openTripAlert(request) {
  if (!state.driverOnline || state.alertOpen || state.driverServiceStep !== 'idle') {
    toast('Termina el viaje actual antes de recibir otro', 'info');
    return;
  }
  const req = request || buildDemoRequest();
  state.pendingRequest = req;
  state.alertOpen = true;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('alertOrigin', req.origin.name);
  set('alertDest', req.dest.name);
  set('alertPickup', fmtKm(req.pickupKm));
  set('alertDist', `${req.quote.km.toFixed(1)} km`);
  set('alertFare', fmtMoney(req.quote.fare));
  set('alertSub', `${req.passenger} · ${req.origin.area || 'Zona centro'}`);
  set('countdownText', String(APP.alertSeconds));

  const ring = $('#countdownCircle');
  if (ring) {
    ring.style.transition = 'none';
    ring.style.strokeDashoffset = '0';
  }

  $('#tripAlert')?.classList.add('is-open');
  Sound.unlock();
  Sound.alert();
  startCountdown();
  refreshIcons();
}

function startCountdown() {
  stopCountdown();
  const total = APP.alertSeconds * 1000;
  const started = performance.now();
  const ring = $('#countdownCircle');
  const text = $('#countdownText');

  currentAlertTimer = setInterval(() => {
    const remain = Math.max(0, total - (performance.now() - started));
    const pct = remain / total;
    if (ring) ring.style.strokeDashoffset = String(RING_LEN * (1 - pct));
    if (text) text.textContent = String(Math.ceil(remain / 1000));
    if (remain <= 0) {
      stopCountdown();
      expireTripAlert();
    }
  }, 80);
}

function stopCountdown() {
  if (currentAlertTimer) {
    clearInterval(currentAlertTimer);
    currentAlertTimer = null;
  }
}

function expireTripAlert() {
  const req = state.pendingRequest;
  if (!req) return;
  state.pendingRequest = null;
  state.alertOpen = false;
  $('#tripAlert')?.classList.remove('is-open');
  pushHistory({
    kind: 'rejected',
    label: `Solicitud expirada · ${req.origin.name}`,
    detail: `Hacia ${req.dest.name} · sin respuesta`,
    amount: '—'
  });
  toast('La solicitud expiró', 'timer');
}

function closeTripAlert(silent = false) {
  stopCountdown();
  state.alertOpen = false;
  state.pendingRequest = null;
  $('#tripAlert')?.classList.remove('is-open');
  if (!silent) renderDriverHistory();
}

function pushHistory(entry) {
  state.stats.history.unshift({ ...entry, time: timeNow() });
  renderDriverHistory();
}

function acceptTrip() {
  const req = state.pendingRequest;
  if (!req) return;
  stopCountdown();
  state.alertOpen = false;
  $('#tripAlert')?.classList.remove('is-open');
  state.activeRequest = req;
  state.pendingRequest = null;
  state.driverServiceStep = 'toPickup';
  Sound.success();
  toast(`Viaje aceptado · ${req.passenger} te espera`, 'check');
  pushHistory({
    kind: 'accepted',
    label: `Aceptado · ${req.passenger} en ${req.origin.name}`,
    detail: `Hacia ${req.dest.name} · ${req.quote.km.toFixed(1)} km`,
    amount: fmtMoney(req.quote.fare)
  });
  renderDriverServiceState();
}

function rejectTrip() {
  const req = state.pendingRequest;
  if (!req) return;
  stopCountdown();
  state.alertOpen = false;
  state.pendingRequest = null;
  $('#tripAlert')?.classList.remove('is-open');
  Sound.tap();
  toast('Viaje rechazado', 'x');
  pushHistory({
    kind: 'rejected',
    label: `Rechazado · ${req.origin.name}`,
    detail: `Hacia ${req.dest.name}`,
    amount: '—'
  });
}

/* Estado del servicio en curso del conductor */
function renderDriverServiceState() {
  const box = $('#driverStateBox');
  const icon = $('#driverStateIcon');
  const title = $('#driverStateTitle');
  const sub = $('#driverStateSub');
  const actions = $('#driverTripActions');
  const arrived = $('#arrivedBtn');
  const start = $('#startBtn');
  const finish = $('#finishBtn');
  const req = state.activeRequest;
  const step = state.driverServiceStep;

  if (!box) return;
  box.style.background = 'rgba(22,224,163,.08)';
  box.style.borderColor = 'rgba(22,224,163,.28)';

  if (step === 'idle' || !req) {
    setOnline(state.driverOnline);
    actions?.classList.add('hidden');
    return;
  }

  actions?.classList.remove('hidden');
  const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };

  if (step === 'toPickup') {
    icon?.setAttribute('data-lucide', 'map-pin');
    if (title) title.textContent = `Recoge a ${req.passenger}`;
    if (sub) sub.textContent = `${req.origin.name} · ${fmtKm(req.pickupKm)} de distancia`;
    show(arrived, true); show(start, false); show(finish, false);
  } else if (step === 'arrived') {
    icon?.setAttribute('data-lucide', 'user-check');
    if (title) title.textContent = 'Conductor a bordo';
    if (sub) sub.textContent = `${req.origin.name} → ${req.dest.name}`;
    show(arrived, false); show(start, true); show(finish, false);
  } else if (step === 'toDropoff') {
    icon?.setAttribute('data-lucide', 'navigation');
    if (title) title.textContent = 'En viaje al destino';
    if (sub) sub.textContent = `${req.dest.name} · ${req.quote.km.toFixed(1)} km`;
    show(arrived, false); show(start, false); show(finish, true);
  }
  refreshIcons();
}

function driverArrived() {
  if (state.driverServiceStep !== 'toPickup') return;
  state.driverServiceStep = 'arrived';
  Sound.message();
  toast('Avisamos al conductor que llegaste', 'bell');
  renderDriverServiceState();
}

function driverStartTrip() {
  if (state.driverServiceStep !== 'arrived') return;
  state.driverServiceStep = 'toDropoff';
  Sound.success();
  toast('Viaje iniciado. ¡Buen camino!', 'play');
  renderDriverServiceState();

  const req = state.activeRequest;
  if (!req) return;
  const map = MapCtl.map;
  if (map) {
    MapCtl.drawRoute(req.origin, req.dest);
    MapCtl.fitPoints([req.origin, req.dest], { padding: [70, 120] });
    MapCtl.animateAlong(req.origin, req.dest, APP.rideDurationMs, null, () => {
      if (state.driverServiceStep === 'toDropoff') toast('Llegaste al destino. Finaliza el viaje.', 'flag');
    });
  }
}

function driverFinishTrip() {
  const req = state.activeRequest;
  if (!req) return;
  const fare = req.quote.fare;

  state.stats.earnings += fare;
  state.stats.trips += 1;
  pushHistory({
    kind: 'done',
    label: `Completado · ${req.passenger} → ${req.dest.name}`,
    detail: `${req.origin.name} · ${req.quote.km.toFixed(1)} km`,
    amount: `+${fmtMoney(fare)}`
  });

  state.driverServiceStep = 'idle';
  state.activeRequest = null;
  Sound.success();
  toast(`Cobro registrado · ${fmtMoney(fare)} MXN`, 'banknote');
  renderDriverStats();
  renderDriverServiceState();
  MapCtl.removeAssignedMoto();
  MapCtl.clearRoute();
}

/* ============================== ROLES ================================ */
function setRole(role) {
  state.role = role;
  const sw = $('#roleSwitch');
  if (sw) {
    sw.dataset.role = role;
    $$('[data-role-btn]', sw).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roleBtn === role)));
  }

  if (role === 'driver') {
    Sound.tap();
    setRadar(false);
    MapCtl.clearAmbient();
    MapCtl.clearRoute();
    MapCtl.removeAssignedMoto();
    renderDriverStats();
    renderDriverHistory();
    renderDriverServiceState();
    setView('viewDriver');
    MapCtl.focusOrigin();
    toast('Modo conductor activo', 'steering-wheel');
  } else {
    MapCtl.spawnAmbient();
    $('#sheet')?.classList.remove('is-collapsed');
    if (state.phase === 'finished') setView('viewFinished');
    else if (state.phase === 'riding' || state.phase === 'assigned') setView('viewRide');
    else if (state.phase === 'searching') setView('viewSearching');
    else {
      state.phase = 'plan';
      setView('viewPassenger');
      renderQuote();
    }
    MapCtl.invalidate();
    MapCtl.spawnAmbient();
  }
  refreshIcons();
}

/* ============================ INTERACCIONES ========================== */
function handleMapClick(latlng) {
  if (state.role !== 'passenger') return;
  if (state.phase !== 'plan') {
    toast('No puedes cambiar el destino durante un viaje', 'lock');
    return;
  }
  const nearest = PLACES.map((p) => ({ p, d: haversine(latlng, p) })).sort((a, b) => a.d - b.d)[0];
  const near = nearest && nearest.d < 0.12;
  const place = {
    id: near ? nearest.p.id : 'pin_map',
    name: near ? nearest.p.name : 'Punto seleccionado en el mapa',
    area: near ? nearest.p.area : `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`,
    lat: latlng.lat,
    lng: latlng.lng
  };
  setDestination(place);
  Sound.tap();
}

function openPlacePicker(mode) {
  state.pickerMode = mode || 'dest';
  const title = $('#placeTitle');
  if (title) title.textContent = state.pickerMode === 'origin' ? 'Elige el punto de recogida' : '¿A dónde vas?';
  const search = $('#placeSearch');
  if (search) search.value = '';
  renderPlaceResults('');
  $('#placeOverlay')?.classList.add('is-open');
  setTimeout(() => search?.focus(), 250);
}

function closePlacePicker() {
  $('#placeOverlay')?.classList.remove('is-open');
}

function renderPlaceResults(query) {
  const box = $('#placeResults');
  if (!box) return;
  const results = filterPlaces(query);
  box.innerHTML = results.length
    ? results.map((p) => placeRowHtml(p, state.pickerMode)).join('')
    : '<p class="text-[11.5px] text-slate-500 text-center py-6">Sin resultados para esa búsqueda.</p>';
  refreshIcons();
}

function choosePlace(id) {
  const place = PLACE_BY_ID[id];
  if (!place) return;
  if (state.pickerMode === 'origin') {
    if (state.dest && state.dest.id === place.id) {
      state.dest = null;
    }
    setOrigin(place);
    toast(`Recogida: ${place.name}`, 'map-pin');
  } else {
    setDestination(place);
    toast(`Destino: ${place.name}`, 'flag');
    closePlacePicker();
    MapCtl.drawDestination(place);
    MapCtl.fitPoints([state.origin, place]);
    renderQuote();
    refreshIcons();
    return;
  }
  closePlacePicker();
  refreshIcons();
}

function swapTrip() {
  if (!state.dest) {
    toast('Elige un destino primero', 'info');
    return;
  }
  const prevOrigin = state.origin;
  const prevDest = state.dest;
  state.origin = { ...prevDest };
  state.dest = { ...prevOrigin };
  const lbl = $('#originLabel');
  if (lbl) lbl.textContent = state.origin.name;
  MapCtl.drawOrigin();
  renderQuote();
  Sound.tap();
}

function confirmTrip() {
  if (!state.dest || !state.quote) return;
  startSearch();
}

/* ============================ RATING ================================= */
function setRating(value) {
  state.rating = value;
  $$('#starPicker button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.star) <= value);
  });
  const rateBtn = $('#rateBtn');
  if (rateBtn) rateBtn.disabled = value === 0;
  Sound.tap();
}

function submitRating() {
  if (!state.rating) return;
  const label = state.rating >= 4 ? '¡Gracias por tu calificación!' : 'Gracias, tomaremos tu opinión en cuenta';
  toast(`${label} ${'★'.repeat(state.rating)}`, 'star');
  Sound.success();
  const rateBtn = $('#rateBtn');
  if (rateBtn) rateBtn.disabled = true;
  setTimeout(() => resetPassengerFlow(), 900);
}

/* ============================ EVENTOS ================================ */
function bindEvents() {
  // Rol
  $$('[data-role-btn]').forEach((btn) => {
    btn.addEventListener('click', () => setRole(btn.dataset.roleBtn));
  });

  // Origen / destino / intercambiar
  $('#originBtn')?.addEventListener('click', () => openPlacePicker('origin'));
  $('#destBtn')?.addEventListener('click', () => openPlacePicker('dest'));
  $('#swapBtn')?.addEventListener('click', swapTrip);
  $('#useMyLocation')?.addEventListener('click', () => {
    setOrigin({ id: 'me', name: 'Mi ubicación · Zona centro', area: 'GPS del dispositivo', lat: APP.center.lat, lng: APP.center.lng });
    MapCtl.focusOrigin();
    toast('Recogida actualizada a tu ubicación', 'locate-fixed');
  });

  // Puntos frecuentes
  $('#quickPlaces')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick]');
    if (!btn) return;
    const place = PLACE_BY_ID[btn.dataset.quick];
    if (!place) return;
    setDestination(place);
    MapCtl.drawDestination(place);
    MapCtl.fitPoints([state.origin, place]);
    toast(`Destino: ${place.name}`, 'flag');
    refreshIcons();
    Sound.tap();
  });

  // Búsqueda en línea del panel
  $('#searchInput')?.addEventListener('input', (e) => renderSearchResults(e.target.value));
  $('#searchResults')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-place]');
    if (!btn) return;
    const place = PLACE_BY_ID[btn.dataset.place];
    if (!place) return;
    setDestination(place);
    MapCtl.drawDestination(place);
    MapCtl.fitPoints([state.origin, place]);
    refreshIcons();
  });

  // Método de pago
  $$('[data-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.payMethod = btn.dataset.pay;
      renderPayMethod();
      Sound.tap();
    });
  });

  $('#confirmBtn')?.addEventListener('click', confirmTrip);
  $('#cancelSearch')?.addEventListener('click', () => cancelPassengerFlow('Búsqueda cancelada'));
  $('#cancelRide')?.addEventListener('click', () => cancelPassengerFlow('Viaje cancelado'));
  $('#editTrip')?.addEventListener('click', () => {
    if (state.phase !== 'plan') return;
    openPlacePicker('dest');
  });

  // Calificación
  $('#starPicker')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-star]');
    if (!btn) return;
    setRating(Number(btn.dataset.star));
  });
  $('#rateBtn')?.addEventListener('click', submitRating);
  $('#newTripBtn')?.addEventListener('click', () => {
    resetPassengerFlow();
    toast('Listo para tu siguiente viaje', 'bike');
  });

  // Seguridad y chat
  $('#safetyBtn')?.addEventListener('click', () => $('#safetyOverlay')?.classList.add('is-open'));
  $('[data-close-safety]')?.addEventListener('click', () => $('#safetyOverlay')?.classList.remove('is-open'));
  $('#chatBtn')?.addEventListener('click', openChat);
  $('[data-close-chat]')?.addEventListener('click', closeChat);
  $('#chatSend')?.addEventListener('click', () => sendChatMessage($('#chatInput')?.value));
  $('#chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage(e.target.value);
  });
  $('#quickReplies')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-reply]');
    if (!btn) return;
    sendChatMessage(btn.dataset.quickReply);
  });
  $('#callBtn')?.addEventListener('click', () => {
    toast(`Llamando a ${state.driver.name} · ${state.driver.phone}`, 'phone-call');
    Sound.tap();
  });

  // Modal de lugares
  $('[data-close-place]')?.addEventListener('click', closePlacePicker);
  $('#placeSearch')?.addEventListener('input', (e) => renderPlaceResults(e.target.value));
  $('#placeResults')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-place]');
    if (!btn) return;
    choosePlace(btn.dataset.place);
  });
}

/* Cierre de overlays al tocar el fondo */
function bindOverlayDismiss() {
  ['chatOverlay', 'placeOverlay', 'safetyOverlay', 'installOverlay'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      if (e.target === el) el.classList.remove('is-open');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.overlay.is-open').forEach((o) => o.classList.remove('is-open'));
    }
  });
}

/* ============================ PWA / SW =============================== */
let deferredInstallPrompt = null;

function bindInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $('#installBanner')?.classList.remove('hidden');
  });

  $('#installBtn')?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (err) {
        /* ignorado */
      }
      deferredInstallPrompt = null;
      $('#installBanner')?.classList.add('hidden');
    } else {
      $('#installOverlay')?.classList.add('is-open');
    }
  });

  $('[data-close-install]')?.addEventListener('click', () => $('#installOverlay')?.classList.remove('is-open'));

  window.addEventListener('appinstalled', () => {
    $('#installBanner')?.classList.add('hidden');
    toast('All Conductor instalada en tu dispositivo', 'check-circle-2');
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Hay una nueva versión disponible. Recarga la app.', 'refresh-cw');
          }
        });
      });
    }).catch(() => {
      /* sin caché offline */
    });
  });
}

/* ============================ INICIO ================================= */
function bootstrap() {
  if (window.lucide) refreshIcons();

  try {
    MapCtl.init();
  } catch (err) {
    console.error('Mapa no disponible:', err);
    toast('No se pudo cargar el mapa. Revisa tu conexión.', 'map-off');
  }

  renderQuickPlaces();
  renderPayMethod();
  renderSearchResults('');
  renderDriverStats();
  renderDriverHistory();
  renderDriverServiceState();

  bindEvents();
  bindOverlayDismiss();
  bindInstall();
  registerServiceWorker();

  // Botones del conductor
  $('#onlineToggle')?.addEventListener('click', () => setOnline(!state.driverOnline));
  $('#demoRequestBtn')?.addEventListener('click', () => {
    if (!state.driverOnline) {
      toast('Primero conéctate para recibir viajes', 'wifi-off');
      return;
    }
    openTripAlert();
  });
  $('#acceptBtn')?.addEventListener('click', acceptTrip);
  $('#rejectBtn')?.addEventListener('click', rejectTrip);
  $('#arrivedBtn')?.addEventListener('click', driverArrived);
  $('#startBtn')?.addEventListener('click', driverStartTrip);
  $('#finishBtn')?.addEventListener('click', driverFinishTrip);
  $('#clearHistory')?.addEventListener('click', () => {
    state.stats.history = [];
    renderDriverHistory();
    toast('Historial limpiado', 'trash-2');
  });

  // Desbloqueo de audio en el primer toque (política de autoplay)
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

  // Ventana: mantener el mapa a escala
  window.addEventListener('resize', () => MapCtl.invalidate());
  window.addEventListener('orientationchange', () => MapCtl.invalidate());

  // Estado inicial
  setOnline(true, { silent: true });
  renderQuote();
  setView('viewPassenger');
  refreshIcons();

  // Cinta de instalación tras unos segundos si la PWA no está instalada
  setTimeout(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (!standalone && !deferredInstallPrompt) {
      $('#installBanner')?.classList.remove('hidden');
    }
  }, 9000);

  // Reloj de tiempo en línea del conductor
  setInterval(() => {
    if (!state.driverOnline) return;
    state.stats.onlineMs += 30000;
    const el = document.getElementById('onlineTime');
    if (el) el.textContent = fmtOnlineTime(state.stats.onlineMs);
  }, 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

