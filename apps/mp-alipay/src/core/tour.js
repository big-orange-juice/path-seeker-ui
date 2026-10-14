const { evaluateApproach, isUsableLocation, DEFAULT_APPROACH_POLICY, parseBoundary, boundaryPolygons, circleToRing } = require('../shared/geo-range');
const { gcj02ToWgs84, toGcj02 } = require('../shared/map-coordinates');
function sorted(items) { return (items || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id))); }
function narrations(stop, locale) { return (stop.guideNarrations || []).filter(n => n.locale === locale); }
function queueFor(stop, narration, options = {}) {
  const extras = options.skipExtra ? [] : sorted(stop.extraAudios);
  const before = extras.filter(e => e.position === 'before' && (!options.playedBefore || !options.playedBefore.includes(e.id)));
  const after = extras.filter(e => e.position === 'after');
  const extra = e => ({ id: e.id, title: e.title, url: e.url, text: '', kind: e.position });
  return before.map(extra).concat(sorted(narration && narration.chapters).map(c => ({ id: c.id, title: c.title, url: c.audioUrl, text: c.text || '', kind: 'chapter' })), after.map(extra));
}
function validPoint(point) { return point && point.longitude !== null && point.latitude !== null && Number.isFinite(point.longitude) && Number.isFinite(point.latitude); }
function mapData(detail, destination, places = []) {
  const system = detail.coordinateSystem || detail.route && detail.route.coordinateSystem || 1;
  const stops = sorted(detail.stops);
  const markers = stops.map((stop, index) => validPoint(stop) ? Object.assign(toGcj02(stop, system), {
    id: index + 1, iconPath: '/assets/marker.png', width: 26, height: 34,
    title: stop.name || '', label: { content: String(index + 1), color: '#183e43', bgColor: '#ffffff', padding: 3, fontSize: 12 }
  }) : null).filter(Boolean);
  let lines = [];
  try {
    const source = detail.geometry || detail.route && detail.route.geometry;
    let geometry = typeof source === 'string' ? JSON.parse(source) : source;
    if (geometry && geometry.type === 'Feature') geometry = geometry.geometry;
    const coordinates = geometry && geometry.type === 'LineString' ? [geometry.coordinates] : geometry && geometry.type === 'MultiLineString' ? geometry.coordinates : [];
    lines = coordinates.filter(line => Array.isArray(line) && line.length > 1 && line.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))).map(line => ({ points: line.map(p => toGcj02({ longitude: p[0], latitude: p[1] }, system)), color: '#183e43DD', width: 5 }));
  } catch (_) { /* 无效路线几何不阻断站点与讲解。 */ }
  const boundaries = [];
  const addRings = (rings, color) => rings.forEach(ring => boundaries.push({ points: ring.map(p => toGcj02({ longitude: p[0], latitude: p[1] }, 1)), color, width: 2 }));
  const addBoundary = (source, color) => { const geometry = parseBoundary(source); if (geometry) boundaryPolygons(geometry).forEach(polygon => addRings(polygon, color)); return !!geometry; };
  // 原生地图以轮廓展示外环与内环，避免把多边形内的水域或禁入区域填平。
  addBoundary(destination && destination.boundaryGeoJson, '#C7A257CC');
  const drawn = new Set();
  stops.forEach(stop => {
    const place = places.find(p => p.id === stop.placeId);
    if (!place || !place.range || drawn.has(place.id)) return;
    drawn.add(place.id);
    if (!addBoundary(place.range.boundaryGeoJson, '#24616ABB') && place.range.type === 'circle' && place.range.radiusMeters > 0) {
      const anchor = validPoint(place) ? place : validPoint(stop) ? gcj02ToWgs84(toGcj02(stop, system)) : null;
      if (anchor) addRings([circleToRing(anchor, place.range.radiusMeters)], '#24616ABB');
    }
  });
  const center = markers[0] || (validPoint(destination) ? toGcj02(destination, destination.coordinateSystem || 1) : { longitude: 116.383, latitude: 39.937 });
  return { markers, polyline: boundaries.concat(lines), longitude: center.longitude, latitude: center.latitude, includePoints: markers.map(m => ({ longitude: m.longitude, latitude: m.latitude })) };
}
function candidates(stops, places, fix, completed, system = 1, now = Date.now(), after = -1) {
  if (!isUsableLocation(fix, DEFAULT_APPROACH_POLICY, now)) return [];
  return stops.map((stop, index) => ({ stop, index })).filter(({ stop, index }) => !completed.includes(stop.id) && index !== after).map(({ stop, index }) => {
    const place = places.find(p => p.id === stop.placeId);
    let anchor = validPoint(place) ? place : validPoint(stop) ? stop : null;
    if (!place && anchor && system !== 1) anchor = gcj02ToWgs84(toGcj02(anchor, system));
    const range = place && place.range;
    const policy = Object.assign({}, DEFAULT_APPROACH_POLICY, range ? { proximityMeters: range.defaultProximityDistanceMeters || DEFAULT_APPROACH_POLICY.proximityMeters, releaseMeters: range.defaultReleaseDistanceMeters || DEFAULT_APPROACH_POLICY.releaseMeters } : {}, stop.triggerRadiusMeters > 0 ? { proximityMeters: stop.triggerRadiusMeters, releaseMeters: Math.max(range && range.defaultReleaseDistanceMeters || DEFAULT_APPROACH_POLICY.releaseMeters, stop.triggerRadiusMeters) } : {});
    const result = evaluateApproach(fix, place && place.range, anchor, policy);
    return { index, order: stop.order || 0, id: stop.id, name: stop.name, distance: result.distanceMeters, approaching: result.approaching };
  }).filter(c => c.approaching).sort((a, b) => Number(a.index <= after) - Number(b.index <= after) || a.order - b.order || a.distance - b.distance);
}
function checkpointMatches(cp, userId, visit, stopId, guideId) {
  return Boolean(cp && cp.userId === userId && visit && cp.visitId === visit.visitId && cp.routeId === visit.routeId && cp.stageId === stopId && cp.guideId === guideId);
}
function canCompleteAudio(queue, failed, browsing) { const chapters = queue.filter(i => i.kind === 'chapter'); return !browsing && !failed && chapters.length > 0 && chapters.every(i => Boolean(i.url)); }
module.exports = { sorted, narrations, queueFor, mapData, candidates, checkpointMatches, canCompleteAudio };
