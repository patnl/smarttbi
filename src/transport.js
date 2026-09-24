/* Transportbewegingen bouwplaats: animeert ritten uit een poortregistratie op een kaart. */
(function () {
  'use strict';

  var EARTH_KM = 40075;
  var DETOUR_FACTOR = 1.3;
  var OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  var CACHE_KEY = 'smarttbi-transport-cache-v1';

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
    vehicle: ['voertuig', 'vehicle', 'type', 'voertuigtype']
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
      var count = col.count >= 0 ? parseNumber(r[col.count]) : 1;
      trips.push({
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

  // ---------- Kaart ----------

  var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([52.2, 5.3], 8);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  var BLUE = '#2456c9', RED = '#e8412c';
  var routeLayer = L.layerGroup().addTo(map);
  var siteMarker = null;

  // ---------- Toestand ----------

  var state = {
    days: [],          // [{date, trips:[...]}] per kalenderdag
    origins: {},       // naam -> {name, coords, route, line, trips, km}
    cumulative: [],    // km t/m dag i
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

  async function prepare(trips) {
    stop();
    routeLayer.clearLayers();
    state.origins = {};
    var site = sitePoint();
    var useRouting = $('use-routing').checked;
    var factor = $('round-trip').checked ? 2 : 1;

    if (siteMarker) siteMarker.remove();
    siteMarker = L.circleMarker(site, { radius: 7, color: '#1c2430', weight: 2, fillColor: RED, fillOpacity: 1 })
      .bindTooltip($('site-name').value || 'Bouwplaats').addTo(map);

    // Unieke herkomsten verzamelen.
    trips.forEach(function (t) {
      if (!state.origins[t.origin]) {
        state.origins[t.origin] = { name: t.origin, coords: isNaN(t.lat) ? null : [t.lat, t.lon], trips: 0, km: 0 };
      }
    });
    var names = Object.keys(state.origins);
    var failed = [];
    for (var i = 0; i < names.length; i++) {
      var o = state.origins[names[i]];
      setStatus('Herkomst ' + (i + 1) + ' van ' + names.length + ' bepalen: ' + o.name + '…');
      if (!o.coords) {
        try { o.coords = await geocode(o.name); } catch (e) { o.coords = null; }
      }
      if (!o.coords) { failed.push(o.name); continue; }
      o.route = await route(o.coords, site, useRouting);
    }

    // Ritten per dag groeperen, inclusief dagen zonder ritten.
    var valid = trips.filter(function (t) { return state.origins[t.origin].route; });
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
    var total = 0;
    state.cumulative = state.days.map(function (day) {
      day.trips.forEach(function (t) { total += state.origins[t.origin].route.km * factor * t.count; });
      return total;
    });

    // Lijnen alvast aanmaken (onzichtbaar tot de eerste rit).
    var bounds = L.latLngBounds([site]);
    names.forEach(function (n) {
      var o = state.origins[n];
      if (!o.route) return;
      o.line = L.polyline(o.route.coords, { color: BLUE, weight: 2.5, opacity: 0.85 });
      o.line.bindTooltip(n);
      bounds.extend(o.route.coords);
    });
    map.fitBounds(bounds, { padding: [30, 30], animate: false });

    renderSummary(valid, factor);
    $('scrub').max = state.days.length - 1;
    ['play', 'restart', 'record', 'scrub'].forEach(function (id) { $(id).disabled = false; });
    var msg = nlf0.format(valid.length) + ' regels over ' + state.days.length + ' dagen ingeladen.';
    if (failed.length) msg += ' Niet gevonden: ' + failed.join(', ') + '.';
    setStatus(msg, failed.length > 0);
    showDay(-1);
  }

  function renderSummary(trips, factor) {
    var count = 0, km = 0, estimated = false;
    Object.keys(state.origins).forEach(function (n) { state.origins[n].trips = 0; state.origins[n].km = 0; });
    trips.forEach(function (t) {
      var o = state.origins[t.origin];
      var k = o.route.km * factor * t.count;
      o.trips += t.count; o.km += k;
      count += t.count; km += k;
      if (o.route.estimated) estimated = true;
    });
    $('kpi-trips').textContent = nlf0.format(count);
    $('kpi-km').textContent = nlf0.format(km);
    $('kpi-earth').textContent = (km / EARTH_KM).toFixed(2).replace('.', ',') + '×';
    $('kpi-avg').textContent = nlf0.format(km / count);
    var top = Object.keys(state.origins).map(function (n) { return state.origins[n]; })
      .filter(function (o) { return o.trips > 0; })
      .sort(function (a, b) { return b.km - a.km; }).slice(0, 10);
    var tbody = $('top-origins');
    tbody.innerHTML = '';
    top.forEach(function (o) {
      var tr = document.createElement('tr');
      [o.name + (o.route.estimated ? ' *' : ''), nlf0.format(o.trips), nlf0.format(o.km)].forEach(function (v) {
        var td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    $('estimate-note').hidden = !estimated;
    $('stats').hidden = false;
  }

  // Toon de kaart zoals die er op dag i uitziet (i = -1: nog niets gereden).
  function showDay(i) {
    state.index = i;
    var active = {};
    if (i >= 0) state.days[i].trips.forEach(function (t) { active[t.origin] = true; });
    var seen = {};
    for (var d = 0; d <= i; d++) state.days[d].trips.forEach(function (t) { seen[t.origin] = true; });

    Object.keys(state.origins).forEach(function (n) {
      var o = state.origins[n];
      if (!o.line) return;
      if (seen[n]) {
        if (!routeLayer.hasLayer(o.line)) routeLayer.addLayer(o.line);
        o.line.setStyle(active[n] ? { color: RED, weight: 5, opacity: 1 } : { color: BLUE, weight: 2.5, opacity: 0.85 });
        if (active[n]) o.line.bringToFront();
      } else if (routeLayer.hasLayer(o.line)) {
        routeLayer.removeLayer(o.line);
      }
    });

    if (siteMarker) siteMarker.bringToFront();

    var km = i >= 0 ? state.cumulative[i] : 0;
    $('ov-date').textContent = i >= 0 ? fmtDate(state.days[i].date) : fmtDate(state.days[0].date);
    $('ov-km').textContent = nf0.format(km) + ' km';
    $('ov-earth').textContent = nf2.format(km / EARTH_KM) + ' x';
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
  window.SmartTbiTransport = { parseCsv: parseCsv, rowsToTrips: rowsToTrips, haversineKm: haversineKm, state: state, showDay: showDay };
})();
