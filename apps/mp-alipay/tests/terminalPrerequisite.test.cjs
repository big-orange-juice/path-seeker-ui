const test = require('node:test');
const assert = require('node:assert/strict');
const { candidates } = require('../dist/core/tour');

test('同坐标回环只锁终点，前序到访即可解锁，完成终点和重新游览分别去重及重置', () => {
  const stops = [
    { id: '391000000000000001', order: 1, longitude: 116.38, latitude: 39.94 },
    { id: '391000000000000002', order: 2, longitude: 116.38, latitude: 39.94 },
    { id: '391000000000000012', order: 12, longitude: 116.39, latitude: 39.95 },
    { id: '391000000000000013', order: 13, longitude: 116.38, latitude: 39.94, autoTriggerPrerequisiteStageId: '391000000000000012' },
  ];
  const now = Date.now(), fix = { longitude: 116.38, latitude: 39.94, accuracy: 5, timestamp: now };
  const ids = (visited, completed = []) => candidates(stops, [], fix, completed, 1, now, -1, visited).map(item => item.id);
  assert.deepEqual(ids([]), [stops[0].id, stops[1].id]);
  assert.deepEqual(ids([stops[2].id], [stops[0].id]), [stops[1].id, stops[3].id]);
  assert.deepEqual(ids([stops[2].id], [stops[0].id, stops[3].id]), [stops[1].id]);
  assert.deepEqual(ids([]), [stops[0].id, stops[1].id]);
});
