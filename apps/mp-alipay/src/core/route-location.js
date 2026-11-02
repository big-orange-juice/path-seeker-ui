const { toGcj02, gcj02ToWgs84 } = require('../shared/map-coordinates');
const { DEFAULT_APPROACH_POLICY, isUsableLocation, metersBetween } = require('../shared/geo-range');

function validPoint(point) {
  return point && Number.isFinite(point.longitude) && Number.isFinite(point.latitude) && Math.abs(point.longitude) <= 180 && Math.abs(point.latitude) <= 90;
}

function project(point, start, end) {
  const longitudeScale = Math.cos(point.latitude * Math.PI / 180);
  if (Math.abs(longitudeScale) < 0.000001 || Math.abs(end.longitude - start.longitude) > 180) return null;
  const segmentLongitude = (end.longitude - start.longitude) * longitudeScale;
  const segmentLatitude = end.latitude - start.latitude;
  const lengthSquared = segmentLongitude ** 2 + segmentLatitude ** 2;
  if (!lengthSquared) return null;
  const fraction = Math.max(0, Math.min(1, (((point.longitude - start.longitude) * longitudeScale) * segmentLongitude + (point.latitude - start.latitude) * segmentLatitude) / lengthSquared));
  return { point: { longitude: start.longitude + fraction * (end.longitude - start.longitude), latitude: start.latitude + fraction * segmentLatitude }, fraction };
}

function routeGraph(routeLines) {
  const nodes = new Map(), segments = [];
  const nodeFor = point => {
    const key = point.longitude.toFixed(7) + ',' + point.latitude.toFixed(7);
    if (!nodes.has(key)) nodes.set(key, { edges: [] });
    return nodes.get(key);
  };
  for (const line of Array.isArray(routeLines) ? routeLines : []) {
    const points = line && Array.isArray(line.points) ? line.points : [];
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1], end = points[index];
      if (!validPoint(start) || !validPoint(end)) continue;
      const length = metersBetween(start, end);
      if (!length || Math.abs(end.longitude - start.longitude) > 180) continue;
      const from = nodeFor(start), to = nodeFor(end);
      from.edges.push({ node: to, length }); to.edges.push({ node: from, length });
      segments.push({ start, end, from, to, length });
    }
  }
  return segments;
}

function candidatesFor(raw, fix, segments) {
  const limit = Math.min(30, Math.max(10, fix.accuracy));
  return segments.map(segment => {
    const projection = project(raw, segment.start, segment.end);
    if (!projection) return null;
    const distance = metersBetween(raw, projection.point);
    return distance <= limit ? Object.assign({ segment, distance }, projection) : null;
  }).filter(Boolean).sort((first, second) => first.distance - second.distance).slice(0, 12);
}

function distancesFrom(node, budget) {
  const distances = new Map([[node, 0]]), pending = new Set([node]);
  while (pending.size) {
    let current = null;
    for (const candidate of pending) if (!current || distances.get(candidate) < distances.get(current)) current = candidate;
    pending.delete(current);
    const distance = distances.get(current);
    for (const edge of current.edges) {
      const next = distance + edge.length;
      if (next <= budget && (!distances.has(edge.node) || next < distances.get(edge.node))) {
        distances.set(edge.node, next); pending.add(edge.node);
      }
    }
  }
  return distances;
}

function travelDistance(previous, next, distances) {
  let distance = previous.segment === next.segment ? Math.abs(previous.fraction - next.fraction) * next.segment.length : Infinity;
  const starts = [[previous.segment.from, previous.fraction * previous.segment.length], [previous.segment.to, (1 - previous.fraction) * previous.segment.length]];
  const ends = [[next.segment.from, next.fraction * next.segment.length], [next.segment.to, (1 - next.fraction) * next.segment.length]];
  for (const [start, offset] of starts) for (const [end, remaining] of ends) {
    const middle = distances(start).get(end);
    if (middle !== undefined) distance = Math.min(distance, offset + middle + remaining);
  }
  return distance;
}

function directionCost(previous, next, raw, lastRaw, movement, accuracy) {
  if (movement < Math.max(6, Math.min(15, accuracy * 0.5))) return 0;
  const scale = Math.cos(raw.latitude * Math.PI / 180);
  const observedLongitude = (raw.longitude - lastRaw.longitude) * scale, observedLatitude = raw.latitude - lastRaw.latitude;
  const matchedLongitude = (next.point.longitude - previous.point.longitude) * scale, matchedLatitude = next.point.latitude - previous.point.latitude;
  const magnitude = Math.hypot(observedLongitude, observedLatitude) * Math.hypot(matchedLongitude, matchedLatitude);
  if (!magnitude) return 0;
  const cosine = Math.max(-1, Math.min(1, (observedLongitude * matchedLongitude + observedLatitude * matchedLatitude) / magnitude));
  return (1 - cosine) * Math.min(10, movement / 2);
}

function rawPoint(fix) {
  if (!fix) return null;
  const raw = fix.gcj || toGcj02(fix, 1);
  return validPoint(raw) ? raw : null;
}

function usableFix(fix, now) {
  return fix && Number.isFinite(fix.timestamp) && Number.isFinite(fix.accuracy) && isUsableLocation(fix, DEFAULT_APPROACH_POLICY, now);
}

function mapLocation(fix, routeLines, now = Date.now()) {
  const raw = rawPoint(fix);
  if (!raw || !usableFix(fix, now)) return raw;
  const nearest = candidatesFor(raw, fix, routeGraph(routeLines))[0];
  return nearest ? nearest.point : raw;
}

function arrivalLocation(fix, point, now = Date.now()) {
  const raw = rawPoint(fix);
  if (!raw || !usableFix(fix, now)) return null;
  if (!validPoint(point) || point.longitude === raw.longitude && point.latitude === raw.latitude) return fix;
  if (metersBetween(raw, point) > Math.min(30, Math.max(10, fix.accuracy))) return fix;
  return Object.assign({}, fix, gcj02ToWgs84(point), { gcj: point });
}

function createRouteMatcher() {
  let source, segments = [], history = null, cachedFix = null, cachedPoint = null;
  function reset() { history = null; cachedFix = null; cachedPoint = null; }
  function match(fix, routeLines, now = Date.now()) {
    if (source !== routeLines) { source = routeLines; segments = routeGraph(routeLines); reset(); }
    const raw = rawPoint(fix);
    if (!raw || !usableFix(fix, now)) { reset(); return raw; }
    if (cachedFix === fix) return cachedPoint;
    if (history && fix.timestamp <= history.timestamp) return raw;
    if (history && fix.timestamp - history.timestamp > DEFAULT_APPROACH_POLICY.maxAgeMs) reset();
    const candidates = candidatesFor(raw, fix, segments);
    if (!candidates.length) { reset(); return raw; }
    let scored;
    if (!history) scored = candidates.map(candidate => Object.assign(candidate, { cost: candidate.distance }));
    else {
      const elapsed = (fix.timestamp - history.timestamp) / 1000;
      const movement = metersBetween(raw, history.raw);
      const uncertainty = Math.min(30, Math.max(fix.accuracy, history.accuracy));
      const budget = Math.max(40, elapsed * 12 + uncertainty);
      const cache = new Map();
      const distances = node => { if (!cache.has(node)) cache.set(node, distancesFrom(node, budget)); return cache.get(node); };
      scored = candidates.map(candidate => {
        let cost = Infinity;
        for (const previous of history.beam) {
          const travelled = travelDistance(previous, candidate, distances);
          if (travelled > budget) continue;
          const transition = Math.max(0, Math.abs(travelled - movement) - uncertainty * 0.5);
          cost = Math.min(cost, previous.cost * 0.7 + transition + directionCost(previous, candidate, raw, history.raw, movement, uncertainty));
        }
        return Object.assign(candidate, { cost: cost + candidate.distance });
      }).filter(candidate => Number.isFinite(candidate.cost));
    }
    if (!scored.length) { reset(); return raw; }
    scored.sort((first, second) => first.cost - second.cost);
    const best = scored[0];
    const alternative = scored.find(candidate => metersBetween(candidate.point, best.point) > 8);
    const ambiguous = alternative && alternative.cost - best.cost < 4;
    const beam = scored.filter(candidate => candidate.cost - best.cost <= 12).slice(0, 6).map(candidate => Object.assign({}, candidate, { cost: candidate.cost - best.cost }));
    history = { beam, raw, accuracy: fix.accuracy, timestamp: fix.timestamp };
    cachedFix = fix; cachedPoint = ambiguous ? raw : best.point;
    return cachedPoint;
  }
  return { match, reset };
}

module.exports = { mapLocation, arrivalLocation, createRouteMatcher };
