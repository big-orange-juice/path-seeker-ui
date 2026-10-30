const { evaluateApproach, isUsableLocation, DEFAULT_APPROACH_POLICY, parseBoundary, boundaryPolygons, circleToRing } = require('../shared/geo-range');
const { gcj02ToWgs84, toGcj02 } = require('../shared/map-coordinates');
function sorted(items) { return (items || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id))); }
function narrations(stop, locale) { return (stop.guideNarrations || []).filter(n => n.locale === locale); }
function stopVideo(stop) { return stop && stop.video ? { id: 'stop-video-' + stop.id, title: stop.name, url: stop.video, text: '', kind: 'interlude-video' } : null; }
function queueFor(stop, narration, options = {}) {
  const extras = options.skipExtra ? [] : sorted(stop.extraAudios);
  const before = extras.filter(e => e.position === 'before' && (!options.playedBefore || !options.playedBefore.includes(e.id)));
  const after = extras.filter(e => e.position === 'after');
  const extra = e => ({ id: e.id, title: e.title, url: e.url, text: '', kind: e.position });
  const video = stopVideo(stop);
  return before.map(extra).concat(sorted(narration && narration.chapters).flatMap(c => [{ id: c.id, title: c.title, url: c.audioUrl, text: c.text || '', kind: 'chapter' }].concat(options.skipExtra ? [] : sorted(c.interludes).filter(m => m.url).map(m => ({ id: m.id, title: m.title, url: m.url, text: '', kind: m.kind === 'video' ? 'interlude-video' : 'interlude-audio' })))), video ? [video] : [], after.map(extra));
}
function mapPoint(point) {
  if (!point || point.longitude === null || point.latitude === null) return null;
  if (point.longitude === undefined || point.latitude === undefined || point.longitude === '' || point.latitude === '') return null;
  const longitude = typeof point.longitude === 'number' ? point.longitude : Number(point.longitude);
  const latitude = typeof point.latitude === 'number' ? point.latitude : Number(point.latitude);
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90 ? { longitude, latitude } : null;
}
function validPoint(point) { return Boolean(mapPoint(point)); }
function mapData(detail, destination, places = []) {
  const system = detail.coordinateSystem || detail.route && detail.route.coordinateSystem || 1;
  const stops = sorted(detail.stops);
  const markers = stops.map((stop, index) => {
    const point = mapPoint(stop);
    if (!point) return null;
    const converted = toGcj02(point, system);
    if (!mapPoint(converted)) return null;
    return Object.assign(converted, {
      id: index + 1, iconPath: '/assets/marker.png', width: 26, height: 34,
      title: stop.name || '', label: { content: String(index + 1), color: '#183e43', bgColor: '#ffffff', padding: 3, fontSize: 12 }
    });
  }).filter(Boolean);
  let lines = [];
  try {
    const source = detail.geometry || detail.route && detail.route.geometry;
    let geometry = typeof source === 'string' ? JSON.parse(source) : source;
    if (geometry && geometry.type === 'Feature') geometry = geometry.geometry;
    const coordinates = geometry && geometry.type === 'LineString' ? [geometry.coordinates] : geometry && geometry.type === 'MultiLineString' ? geometry.coordinates : [];
    lines = coordinates.filter(line => Array.isArray(line) && line.length > 1 && line.every(p => mapPoint({ longitude: p && p[0], latitude: p && p[1] }))).map(line => ({ points: line.map(p => toGcj02(mapPoint({ longitude: p[0], latitude: p[1] }), system)), color: '#183e4399', width: 5 }));
  } catch (_) { /* 无效路线几何不阻断站点与讲解。 */ }
  const boundaries = [];
  const addRings = (rings, color) => rings.forEach(ring => {
    const points = ring.map(p => mapPoint({ longitude: p[0], latitude: p[1] })).filter(Boolean).map(p => toGcj02(p, 1));
    if (points.length > 1) boundaries.push({ points, color, width: 2 });
  });
  const addBoundary = (source, color) => { const geometry = parseBoundary(source); if (geometry) boundaryPolygons(geometry).forEach(polygon => addRings(polygon, color)); return !!geometry; };
  // 原生地图以轮廓展示外环与内环，避免把多边形内的水域或禁入区域填平。
  addBoundary(destination && destination.boundaryGeoJson, '#C7A25799');
  const drawn = new Set();
  stops.forEach(stop => {
    const place = places.find(p => p.id === stop.placeId);
    if (!place || !place.range || drawn.has(place.id)) return;
    drawn.add(place.id);
    if (!addBoundary(place.range.boundaryGeoJson, '#24616A80') && place.range.type === 'circle' && place.range.radiusMeters > 0) {
      const anchor = validPoint(place) ? place : validPoint(stop) ? gcj02ToWgs84(toGcj02(stop, system)) : null;
      if (anchor) addRings([circleToRing(anchor, place.range.radiusMeters)], '#24616A80');
    }
  });
  const safeLines = boundaries.concat(lines).map(line => ({ ...line, points: line.points.filter(point => mapPoint(point)) })).filter(line => line.points.length > 1);
  const destinationPoint = mapPoint(destination);
  const center = markers[0] || (destinationPoint ? toGcj02(destinationPoint, destination.coordinateSystem || 1) : { longitude: 116.383, latitude: 39.937 });
  return { markers, polyline: safeLines, routeLines: lines, boundaryLines: boundaries, longitude: Number.isFinite(center.longitude) ? center.longitude : 116.383, latitude: Number.isFinite(center.latitude) ? center.latitude : 39.937, includePoints: markers.map(m => ({ longitude: m.longitude, latitude: m.latitude })) };
}
function candidates(stops, places, fix, completed, system = 1, now = Date.now(), after = -1) {
  if (!isUsableLocation(fix, DEFAULT_APPROACH_POLICY, now)) return [];
  return stops.map((stop, index) => ({ stop, index })).filter(({ stop, index }) => !completed.includes(stop.id) && index !== after).map(({ stop, index }) => {
    const place = places.find(p => p.id === stop.placeId);
    const anchor = validPoint(place) ? mapPoint(place) : validPoint(stop) ? (system === 1 ? mapPoint(stop) : gcj02ToWgs84(toGcj02(mapPoint(stop), system))) : null;
    const range = place && place.range;
    const policy = Object.assign({}, DEFAULT_APPROACH_POLICY, range ? { proximityMeters: range.defaultProximityDistanceMeters || DEFAULT_APPROACH_POLICY.proximityMeters, releaseMeters: range.defaultReleaseDistanceMeters || DEFAULT_APPROACH_POLICY.releaseMeters } : {}, stop.triggerRadiusMeters > 0 ? { proximityMeters: stop.triggerRadiusMeters, releaseMeters: Math.max(range && range.defaultReleaseDistanceMeters || DEFAULT_APPROACH_POLICY.releaseMeters, stop.triggerRadiusMeters) } : {});
    let result = evaluateApproach(fix, range, anchor, policy);
    if (result.distanceMeters === null && anchor) result = evaluateApproach(fix, null, anchor, Object.assign({}, policy, { proximityMeters: result.proximityMeters, releaseMeters: result.releaseMeters }));
    return { index, order: stop.order || 0, id: stop.id, name: stop.name, distance: result.distanceMeters, withinRange: result.withinRange, approaching: result.approaching };
  }).filter(c => c.approaching).sort((a, b) => Number(a.index <= after) - Number(b.index <= after) || a.order - b.order || a.distance - b.distance);
}
function checkpointMatches(cp, userId, visit, stopId, guideId) {
  return Boolean(cp && cp.userId === userId && visit && cp.visitId === visit.visitId && cp.routeId === visit.routeId && cp.stageId === stopId && cp.guideId === guideId);
}
function canCompleteAudio(queue, failed, browsing, completedItemIds = []) {
  if (browsing || failed) return false;
  const chapters = queue.filter(item => item.kind === 'chapter');
  if (chapters.length) return chapters.every(item => Boolean(item.url));
  return queue.some(item => item.kind === 'interlude-video' && item.id.indexOf('stop-video-') === 0 && completedItemIds.includes(item.id));
}
module.exports = { sorted, narrations, stopVideo, queueFor, mapData, candidates, checkpointMatches, canCompleteAudio };
