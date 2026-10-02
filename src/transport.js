/* Transportbewegingen bouwplaats: animeert ritten uit een poortregistratie op een kaart. */
(function () {
  'use strict';

  var EARTH_KM = 40075;
  var DETOUR_FACTOR = 1.3;
  var OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  var CACHE_KEY = 'smarttbi-transport-cache-v1';  // alleen geocoder- en wegroutes

  // Veelvoorkomende herkomsten, zodat een CSV zonder coördinaten ook zonder geocoder werkt.
  var GAZETTEER = {
    'almere': [52.3700, 5.2140], 'amersfoort': [52.1560, 5.3870], 'amsterdam': [52.3730, 4.8920],
    'amsterdam westpoort': [52.4050, 4.8200], 'apeldoorn': [52.2110, 5.9690], 'arnhem': [51.9850, 5.8990],
    'breda': [51.5890, 4.7760], 'culemborg': [51.9550, 5.2270], 'den bosch': [51.6980, 5.3040],
    "'s-hertogenbosch": [51.6980, 5.3040], 'den haag': [52.0700, 4.3000], 'deventer': [52.2550, 6.1630],
    'eindhoven': [51.4410, 5.4700], 'enschede': [52.2210, 6.8940], 'gorinchem': [51.8350, 4.9740],
    'hengelo': [52.2660, 6.7930], 'hoorn': [52.6420, 5.0600], 'houten': [52.0280, 5.1680],
    'lelystad': [52.5180, 5.4710], 'moerdijk': [51.6860, 4.6170], 'nieuwegein': [52.0290, 5.0800],
    'nijmegen': [51.8420, 5.8580], 'rotterdam': [51.9225, 4.4792], 'rotterdam waalhaven': [51.8870, 4.4400],
    'tiel': [51.8860, 5.4290], 'utrecht': [52.0907, 5.1214], 'veenendaal': [52.0280, 5.5580],
    'woerden': [52.0850, 4.8830], 'zaandam': [52.4420, 4.8290], 'zwolle': [52.5160, 6.0830]
  };

  var $ = function (id) { return document.getElementById(id); };
  var nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nlf0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });

  // ---------- CSV ----------

  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var firstLine = text.split(/\r?\n/, 1)[0];
    var delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    var rows = [], row = [], field = '', inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(function (v) { return v.trim() !== ''; })) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(function (v) { return v.trim() !== ''; })) rows.push(row);
    return rows;
  }

  var ALIASES = {
    date: ['datum', 'date', 'dag', 'tijdstip', 'datetime'],
    origin: ['herkomst', 'origin', 'plaats', 'vertrekplaats', 'leverancier', 'van', 'from'],
    lat: ['lat', 'latitude', 'breedtegraad'],
    lon: ['lon', 'lng', 'long', 'longitude', 'lengtegraad'],
    count: ['aantal', 'count', 'ritten', 'trips'],
    vehicle: ['voertuig', 'vehicle', 'type', 'voertuigtype'],
    mode: ['modaliteit', 'mode', 'vervoerwijze', 'modality', 'transportmiddel']
  };

  function parseNumber(v) {
    if (v == null) return NaN;
    v = String(v).trim();
    if (v === '') return NaN;
    return Number(v.replace(',', '.'));
  }

  function parseDate(v) {
    v = String(v || '').trim();
    var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return null;
  }

  function rowsToTrips(rows) {
    if (rows.length < 2) throw new Error('Het bestand bevat geen gegevensregels.');
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var col = {};
    Object.keys(ALIASES).forEach(function (key) {
      col[key] = header.findIndex(function (h) { return ALIASES[key].indexOf(h) !== -1; });
    });
    if (col.date < 0) throw new Error('Kolom "datum" niet gevonden.');
    if (col.origin < 0 && (col.lat < 0 || col.lon < 0)) {
      throw new Error('Kolom "herkomst" (of "lat" en "lon") niet gevonden.');
    }
    var trips = [], skipped = 0;
    rows.slice(1).forEach(function (r) {
      var date = parseDate(r[col.date]);
      if (!date) { skipped++; return; }
      var lat = col.lat >= 0 ? parseNumber(r[col.lat]) : NaN;
      var lon = col.lon >= 0 ? parseNumber(r[col.lon]) : NaN;
      var origin = col.origin >= 0 ? r[col.origin].trim() : '';
      if (!origin && !isNaN(lat)) origin = lat.toFixed(3) + ', ' + lon.toFixed(3);
      if (!origin) { skipped++; return; }
      var mode = parseMode(col.mode >= 0 ? r[col.mode] : '');
      if (!mode) { skipped++; return; }
      var count = col.count >= 0 ? parseNumber(r[col.count]) : 1;
      trips.push({
        mode: mode,
        date: date,
        origin: origin,
        lat: lat,
        lon: lon,
        count: isNaN(count) || count <= 0 ? 1 : count,
        vehicle: col.vehicle >= 0 ? r[col.vehicle].trim() : ''
      });
    });
    if (!trips.length) throw new Error('Geen geldige regels gevonden (controleer de datumnotatie).');
    return { trips: trips, skipped: skipped };
  }

  // ---------- Geo ----------

  function haversineKm(a, b) {
    var toRad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * toRad, dLon = (b[1] - a[1]) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  var cache = { geo: {}, route: {} };
  try {
    var stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (stored && stored.geo && stored.route) cache = stored;
  } catch (e) { /* geen opslag beschikbaar */ }

  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) { /* negeren */ }
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, timeoutMs || 10000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  async function geocode(name) {
    var key = name.toLowerCase();
    if (GAZETTEER[key]) return GAZETTEER[key];
    if (cache.geo[key]) return cache.geo[key];
    // Nominatim staat maximaal 1 verzoek per seconde toe.
    await sleep(1100);
    var url = NOMINATIM_URL + '?format=json&limit=1&countrycodes=nl,be,de&q=' + encodeURIComponent(name);
    var res = await fetchJson(url);
    if (!res.length) return null;
    cache.geo[key] = [Number(res[0].lat), Number(res[0].lon)];
    saveCache();
    return cache.geo[key];
  }

  async function route(from, to, useRouting) {
    var straight = { km: haversineKm(from, to) * DETOUR_FACTOR, coords: [from, to], estimated: true };
    if (!useRouting) return straight;
    var key = from.map(function (v) { return v.toFixed(4); }).join(',') + '>' +
      to.map(function (v) { return v.toFixed(4); }).join(',');
    if (cache.route[key]) return cache.route[key];
    try {
      var url = OSRM_URL + from[1] + ',' + from[0] + ';' + to[1] + ',' + to[0] +
        '?overview=simplified&geometries=geojson';
      var res = await fetchJson(url);
      if (res.code !== 'Ok' || !res.routes.length) return straight;
      var r = res.routes[0];
      var result = {
        km: r.distance / 1000,
        coords: r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
        estimated: false
      };
      cache.route[key] = result;
      saveCache();
      return result;
    } catch (e) {
      return straight;
    }
  }

  // ---------- Modaliteiten ----------

  var MODES = {
    road: { label: 'Weg', color: '#2456c9', dash: null, unit: 'ritten' },
    water: { label: 'Water', color: '#0b9bb0', dash: null, unit: 'vaarten' },
    ov: { label: 'OV', color: '#2e9d4a', dash: '6 6', unit: 'reizen' }
  };
  var MODE_ORDER = ['road', 'water', 'ov'];
  var MODE_ALIASES = {
    road: ['weg', 'road', 'truck', 'vrachtwagen', 'auto', 'wegvervoer'],
    water: ['water', 'schip', 'binnenvaart', 'boot', 'vaart', 'ship', 'barge', 'ponton', 'watervervoer'],
    ov: ['ov', 'trein', 'bus', 'tram', 'metro', 'train', 'openbaar vervoer', 'public transport']
  };
  var OV_FACTOR = 1.2;      // spoor/bus is iets langer dan hemelsbreed
  var WATER_FACTOR = 1.1;   // bochten tussen twee knooppunten van het netwerk

  function parseMode(v) {
    v = String(v || '').trim().toLowerCase();
    if (!v) return 'road';
    for (var m in MODE_ALIASES) if (MODE_ALIASES[m].indexOf(v) !== -1) return m;
    return null;
  }

  function emptyKm() { return { road: 0, water: 0, ov: 0 }; }

  // Schematisch netwerk van de grote Nederlandse vaarwegen (knooppunten bij benadering).
  var WATER_NODES = {
    amsWest: [52.405, 4.820], zaandam: [52.435, 4.830], amsOost: [52.378, 4.960], nigtevecht: [52.270, 5.030],
    maarssen: [52.140, 5.040], lageWeide: [52.102, 5.075], jutphaas: [52.035, 5.100], wijkBD: [51.975, 5.330],
    tiel: [51.890, 5.430], nijmegen: [51.852, 5.860], pannerden: [51.885, 6.050], arnhem: [51.975, 5.905],
    westervoort: [51.960, 5.970], zutphen: [52.145, 6.195], deventer: [52.250, 6.150], zwolle: [52.500, 6.060],
    kampen: [52.555, 5.910], ketelmeer: [52.595, 5.780], lelystad: [52.520, 5.430], markermeer: [52.450, 5.150],
    hoorn: [52.630, 5.070], gooimeer: [52.330, 5.250], almere: [52.365, 5.215], amersfoort: [52.165, 5.385],
    lochem: [52.165, 6.420], hengelo: [52.255, 6.770], zaltbommel: [51.815, 5.250], gorinchem: [51.828, 4.970],
    dordrecht: [51.815, 4.670], rotterdam: [51.900, 4.490], waalhaven: [51.885, 4.440], moerdijk: [51.690, 4.600],
    stAndries: [51.800, 5.330], denBosch: [51.715, 5.300], veghel: [51.615, 5.540], eindhoven: [51.455, 5.470],
    bergscheMaas: [51.720, 4.980], breda: [51.640, 4.760]
  };
  var WATER_EDGES = [
    ['amsWest', 'zaandam'], ['amsWest', 'amsOost'], ['amsOost', 'nigtevecht'], ['nigtevecht', 'maarssen'],
    ['maarssen', 'lageWeide'], ['lageWeide', 'jutphaas'], ['jutphaas', 'wijkBD'], ['wijkBD', 'tiel'],
    ['tiel', 'nijmegen'], ['nijmegen', 'pannerden'], ['pannerden', 'arnhem'], ['arnhem', 'wijkBD'],
    ['pannerden', 'westervoort'], ['westervoort', 'zutphen'], ['zutphen', 'deventer'], ['deventer', 'zwolle'],
    ['zwolle', 'kampen'], ['kampen', 'ketelmeer'], ['ketelmeer', 'lelystad'], ['lelystad', 'markermeer'],
    ['markermeer', 'amsOost'], ['markermeer', 'hoorn'], ['markermeer', 'gooimeer'], ['gooimeer', 'almere'],
    ['gooimeer', 'amersfoort'], ['zutphen', 'lochem'], ['lochem', 'hengelo'], ['tiel', 'zaltbommel'],
    ['zaltbommel', 'gorinchem'], ['gorinchem', 'dordrecht'], ['dordrecht', 'rotterdam'], ['rotterdam', 'waalhaven'],
    ['dordrecht', 'moerdijk'], ['zaltbommel', 'stAndries'], ['stAndries', 'denBosch'], ['denBosch', 'veghel'],
    ['veghel', 'eindhoven'], ['denBosch', 'bergscheMaas'], ['bergscheMaas', 'moerdijk'], ['moerdijk', 'breda']
  ];

  function nearestWaterNode(p) {
    var best = null, bestKm = Infinity;
    Object.keys(WATER_NODES).forEach(function (n) {
      var km = haversineKm(p, WATER_NODES[n]);
      if (km < bestKm) { best = n; bestKm = km; }
    });
    return { node: best, km: bestKm };
  }

  // Kortste pad over het netwerk (Dijkstra; het netwerk is klein).
  function waterPath(a, b) {
    var adj = {};
    WATER_EDGES.forEach(function (e) {
      var km = haversineKm(WATER_NODES[e[0]], WATER_NODES[e[1]]) * WATER_FACTOR;
      (adj[e[0]] = adj[e[0]] || []).push([e[1], km]);
      (adj[e[1]] = adj[e[1]] || []).push([e[0], km]);
    });
    var dist = {}, prev = {}, todo = Object.keys(WATER_NODES);
    todo.forEach(function (n) { dist[n] = Infinity; });
    dist[a] = 0;
    while (todo.length) {
      todo.sort(function (x, y) { return dist[x] - dist[y]; });
      var u = todo.shift();
      if (u === b || dist[u] === Infinity) break;
      (adj[u] || []).forEach(function (e) {
        if (dist[u] + e[1] < dist[e[0]]) { dist[e[0]] = dist[u] + e[1]; prev[e[0]] = u; }
      });
    }
    if (dist[b] === Infinity) return null;
    var nodes = [b];
    while (nodes[0] !== a) nodes.unshift(prev[nodes[0]]);
    return { km: dist[b], coords: nodes.map(function (n) { return WATER_NODES[n]; }) };
  }

  // Route per modaliteit. km is uitgesplitst, want bij water horen voor- en natransport over de weg.
  async function laneRoute(mode, from, to, useRouting) {
    var km = emptyKm();
    if (mode === 'water') {
      var qa = nearestWaterNode(from), qb = nearestWaterNode(to);
      var path = waterPath(qa.node, qb.node);
      if (path) {
        km.water = path.km;
        km.road = (qa.km + qb.km) * DETOUR_FACTOR;
        return { km: km, coords: [from].concat(path.coords, [to]), estimated: false, schematic: true, preKm: qa.km };
      }
    }
    if (mode === 'ov') {
      km.ov = haversineKm(from, to) * OV_FACTOR;
      return { km: km, coords: [from, to], estimated: true };
    }
    var r = await route(from, to, useRouting);
    km.road = r.km;
    return { km: km, coords: r.coords, estimated: r.estimated };
  }

  function sumKm(km) { return km.road + km.water + km.ov; }

  // ---------- Kaart ----------

  var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([52.2, 5.3], 8);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  var RED = '#e8412c';
  var routeLayer = L.layerGroup().addTo(map);
  var siteMarker = null;

  // ---------- Toestand ----------

  var state = {
    days: [],          // [{date, trips:[...]}] per kalenderdag
    places: {},        // herkomst -> coördinaten
    lanes: {},         // 'modaliteit|herkomst' -> {name, mode, route, line, trips, km}
    cumulative: [],    // km per modaliteit t/m dag i
    modes: [],         // modaliteiten die in de data voorkomen
    index: -1,
    playing: false,
    timer: null
  };

  function setStatus(msg, isError) {
    var el = $('status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  function fmtDate(d) {
    var dd = String(d.getUTCDate()).padStart(2, '0');
    var mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return dd + '-' + mm + '-' + d.getUTCFullYear();
  }

  function sitePoint() {
    var lat = parseNumber($('site-lat').value), lon = parseNumber($('site-lon').value);
    if (isNaN(lat) || isNaN(lon)) throw new Error('Vul geldige coördinaten voor de bouwplaats in.');
    return [lat, lon];
  }

  function laneKey(t) { return t.mode + '|' + t.origin; }

  function baseStyle(mode) {
    return { color: MODES[mode].color, weight: 2.5, opacity: 0.85, dashArray: MODES[mode].dash };
  }

  async function prepare(trips) {
    stop();
    routeLayer.clearLayers();
    state.places = {};
    state.lanes = {};
    var site = sitePoint();
    var useRouting = $('use-routing').checked;
    var factor = $('round-trip').checked ? 2 : 1;

    if (siteMarker) siteMarker.remove();
    siteMarker = L.circleMarker(site, { radius: 7, color: '#1c2430', weight: 2, fillColor: RED, fillOpacity: 1 })
      .bindTooltip($('site-name').value || 'Bouwplaats').addTo(map);

    // Unieke herkomsten en combinaties herkomst + modaliteit verzamelen.
    trips.forEach(function (t) {
      if (!(t.origin in state.places)) state.places[t.origin] = isNaN(t.lat) ? null : [t.lat, t.lon];
      var k = laneKey(t);
      if (!state.lanes[k]) state.lanes[k] = { name: t.origin, mode: t.mode, trips: 0, km: emptyKm() };
    });
    var names = Object.keys(state.places);
    var failed = [];
    for (var i = 0; i < names.length; i++) {
      if (state.places[names[i]]) continue;
      setStatus('Herkomst ' + (i + 1) + ' van ' + names.length + ' bepalen: ' + names[i] + '…');
      try { state.places[names[i]] = await geocode(names[i]); } catch (e) { state.places[names[i]] = null; }
      if (!state.places[names[i]]) failed.push(names[i]);
    }
    var keys = Object.keys(state.lanes);
    for (var j = 0; j < keys.length; j++) {
      var lane = state.lanes[keys[j]];
      var from = state.places[lane.name];
      if (!from) continue;
      setStatus('Route ' + (j + 1) + ' van ' + keys.length + ' berekenen: ' + lane.name + ' (' + MODES[lane.mode].label + ')…');
      lane.route = await laneRoute(lane.mode, from, site, useRouting);
    }

    // Ritten per dag groeperen, inclusief dagen zonder ritten.
    var valid = trips.filter(function (t) { return state.lanes[laneKey(t)].route; });
    if (!valid.length) throw new Error('Geen enkele herkomst kon op de kaart worden geplaatst.');
    valid.sort(function (a, b) { return a.date - b.date; });
    var byDay = {};
    valid.forEach(function (t) {
      var k = t.date.getTime();
      (byDay[k] = byDay[k] || []).push(t);
    });
    state.days = [];
    var DAY = 86400000;
    for (var d = valid[0].date.getTime(); d <= valid[valid.length - 1].date.getTime(); d += DAY) {
      state.days.push({ date: new Date(d), trips: byDay[d] || [] });
    }
    var total = emptyKm();
    state.cumulative = state.days.map(function (day) {
      day.trips.forEach(function (t) {
        var km = state.lanes[laneKey(t)].route.km;
        MODE_ORDER.forEach(function (m) { total[m] += km[m] * factor * t.count; });
      });
      return { road: total.road, water: total.water, ov: total.ov };
    });
    state.modes = MODE_ORDER.filter(function (m) { return valid.some(function (t) { return t.mode === m; }); });

    // Lijnen alvast aanmaken (onzichtbaar tot de eerste rit).
    var bounds = L.latLngBounds([site]);
    keys.forEach(function (k) {
      var l = state.lanes[k];
      if (!l.route) return;
      l.line = L.polyline(l.route.coords, baseStyle(l.mode));
      l.line.bindTooltip(l.name + ' (' + MODES[l.mode].label + ')');
      bounds.extend(l.route.coords);
    });
    map.fitBounds(bounds, { padding: [30, 30], animate: false });

    renderSummary(valid, factor);
    renderModeOverlay();
    $('scrub').max = state.days.length - 1;
    ['play', 'restart', 'record', 'scrub'].forEach(function (id) { $(id).disabled = false; });
    var msg = nlf0.format(valid.length) + ' regels over ' + state.days.length + ' dagen ingeladen.';
    if (failed.length) msg += ' Niet gevonden: ' + failed.join(', ') + '.';
    setStatus(msg, failed.length > 0);
    showDay(-1);
  }

  function cell(tr, v) {
    var td = document.createElement('td');
    td.textContent = v;
    tr.appendChild(td);
    return td;
  }

  function renderSummary(trips, factor) {
    var count = 0, km = 0, estimated = false, schematic = false;
    var perMode = {};
    MODE_ORDER.forEach(function (m) { perMode[m] = { count: 0, km: 0 }; });
    Object.keys(state.lanes).forEach(function (k) { state.lanes[k].trips = 0; state.lanes[k].km = emptyKm(); });
    trips.forEach(function (t) {
      var l = state.lanes[laneKey(t)];
      l.trips += t.count;
      perMode[t.mode].count += t.count;
      count += t.count;
      MODE_ORDER.forEach(function (m) {
        var k = l.route.km[m] * factor * t.count;
        l.km[m] += k; perMode[m].km += k; km += k;
      });
      if (l.route.estimated && t.mode === 'road') estimated = true;
      if (l.route.schematic) schematic = true;
    });
    $('kpi-trips').textContent = nlf0.format(count);
    $('kpi-km').textContent = nlf0.format(km);
    $('kpi-earth').textContent = (km / EARTH_KM).toFixed(2).replace('.', ',') + '×';
    $('kpi-avg').textContent = nlf0.format(km / count);

    var mbody = $('mode-table');
    mbody.innerHTML = '';
    // km per modaliteit waarin ze gereden/gevaren zijn, net als de teller op de kaart.
    MODE_ORDER.forEach(function (m) {
      if (!perMode[m].count && !perMode[m].km) return;
      var tr = document.createElement('tr');
      var name = cell(tr, MODES[m].label);
      name.className = 'mode-' + m;
      cell(tr, nlf0.format(perMode[m].count) + ' ' + MODES[m].unit);
      cell(tr, nlf0.format(perMode[m].km));
      cell(tr, Math.round(perMode[m].km / km * 100) + '%');
      mbody.appendChild(tr);
    });
    $('water-note').hidden = !schematic;
    $('ov-note').hidden = state.modes.indexOf('ov') === -1;

    var top = Object.keys(state.lanes).map(function (k) { return state.lanes[k]; })
      .filter(function (l) { return l.trips > 0; })
      .sort(function (a, b) { return sumKm(b.km) - sumKm(a.km); }).slice(0, 10);
    var tbody = $('top-origins');
    tbody.innerHTML = '';
    top.forEach(function (l) {
      var tr = document.createElement('tr');
      cell(tr, l.name + (l.route.estimated && l.mode === 'road' ? ' *' : ''));
      cell(tr, MODES[l.mode].label).className = 'mode-' + l.mode;
      cell(tr, nlf0.format(l.trips));
      cell(tr, nlf0.format(sumKm(l.km)));
      tbody.appendChild(tr);
    });
    $('estimate-note').hidden = !estimated;
    $('stats').hidden = false;
  }

  function renderModeOverlay() {
    var box = $('ov-modes');
    box.innerHTML = '';
    // Alleen uitsplitsen als er meer dan wegvervoer in de data zit.
    box.hidden = state.modes.length < 2 && state.modes[0] === 'road';
    MODE_ORDER.forEach(function (m) {
      if (state.modes.indexOf(m) === -1 && !(m === 'road' && state.modes.indexOf('water') !== -1)) return;
      var row = document.createElement('div');
      row.className = 'mode-row';
      var sw = document.createElement('span');
      sw.className = 'swatch mode-' + m;
      var lbl = document.createElement('span');
      lbl.textContent = MODES[m].label;
      var val = document.createElement('span');
      val.className = 'mode-val';
      val.id = 'ov-mode-' + m;
      row.appendChild(sw); row.appendChild(lbl); row.appendChild(val);
      box.appendChild(row);
    });
  }

  // Toon de kaart zoals die er op dag i uitziet (i = -1: nog niets gereden).
  function showDay(i) {
    state.index = i;
    var active = {};
    if (i >= 0) state.days[i].trips.forEach(function (t) { active[laneKey(t)] = true; });
    var seen = {};
    for (var d = 0; d <= i; d++) state.days[d].trips.forEach(function (t) { seen[laneKey(t)] = true; });

    Object.keys(state.lanes).forEach(function (k) {
      var l = state.lanes[k];
      if (!l.line) return;
      if (seen[k]) {
        if (!routeLayer.hasLayer(l.line)) routeLayer.addLayer(l.line);
        l.line.setStyle(active[k] ? { color: RED, weight: 5, opacity: 1, dashArray: MODES[l.mode].dash } : baseStyle(l.mode));
        if (active[k]) l.line.bringToFront();
      } else if (routeLayer.hasLayer(l.line)) {
        routeLayer.removeLayer(l.line);
      }
    });

    if (siteMarker) siteMarker.bringToFront();

    var cum = i >= 0 ? state.cumulative[i] : emptyKm();
    var km = sumKm(cum);
    $('ov-date').textContent = i >= 0 ? fmtDate(state.days[i].date) : fmtDate(state.days[0].date);
    $('ov-km').textContent = nf0.format(km) + ' km';
    $('ov-earth').textContent = nf2.format(km / EARTH_KM) + ' x';
    MODE_ORDER.forEach(function (m) {
      var el = $('ov-mode-' + m);
      if (el) el.textContent = nf0.format(cum[m]) + ' km';
    });
    $('scrub').value = Math.max(i, 0);
  }

  // ---------- Afspelen ----------

  function tick() {
    if (state.index >= state.days.length - 1) { stop(); return; }
    showDay(state.index + 1);
  }

  function play() {
    if (!state.days.length) return;
    if (state.index >= state.days.length - 1) showDay(-1);
    state.playing = true;
    $('play').textContent = '❚❚ Pauze';
    clearInterval(state.timer);
    state.timer = setInterval(tick, 1000 / Number($('speed').value));
  }

  function stop() {
    state.playing = false;
    clearInterval(state.timer);
    $('play').textContent = '▶ Afspelen';
  }

  $('play').addEventListener('click', function () { state.playing ? stop() : play(); });
  $('restart').addEventListener('click', function () { stop(); showDay(-1); play(); });
  $('speed').addEventListener('input', function () {
    $('speed-label').textContent = this.value;
    if (state.playing) play();
  });
  $('scrub').addEventListener('input', function () { stop(); showDay(Number(this.value)); });

  // ---------- Opnemen (tabblad als video) ----------

  $('record').addEventListener('click', async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setStatus('Opnemen wordt door deze browser niet ondersteund. Gebruik Chrome of Edge.', true);
      return;
    }
    var stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true });
    } catch (e) {
      setStatus('Opname geannuleerd.');
      return;
    }
    var chunks = [];
    var rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
      a.download = 'transportbewegingen.webm';
      a.click();
      setStatus('Video opgeslagen als transportbewegingen.webm.');
    };
    rec.start();
    setStatus('Bezig met opnemen…');
    stop();
    showDay(-1);
    await sleep(500);
    play();
    var wait = setInterval(function () {
      if (!state.playing) {
        clearInterval(wait);
        setTimeout(function () { rec.stop(); }, 1500);
      }
    }, 200);
  });

  // ---------- Inladen ----------

  async function loadText(text) {
    try {
      var parsed = rowsToTrips(parseCsv(text));
      await prepare(parsed.trips);
      if (parsed.skipped) setStatus($('status').textContent + ' ' + parsed.skipped + ' regels overgeslagen.');
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  $('csv-file').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { loadText(reader.result); };
    reader.readAsText(file);
  });

  $('load-example').addEventListener('click', function () {
    setStatus('Voorbeelddata laden…');
    fetch('voorbeeld-poortregistratie.csv')
      .then(function (r) { return r.text(); })
      .then(loadText)
      .catch(function () { setStatus('Voorbeelddata kon niet worden geladen.', true); });
  });

  // Voor tests en hergebruik.
  window.SmartTbiTransport = { parseCsv: parseCsv, rowsToTrips: rowsToTrips, haversineKm: haversineKm, waterPath: waterPath, state: state, showDay: showDay };
})();
