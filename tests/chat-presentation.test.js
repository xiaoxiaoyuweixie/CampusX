const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { withMessageTimes } = require('../miniprogram/utils/chat-presentation');

const timestamp = value => Date.parse(`${value}+08:00`);
const labels = messages => withMessageTimes(messages).map(item => item.timeLabel);
const message = (value, extra = {}) => ({ createdTimestamp: timestamp(value), ...extra });

test('empty lists have no time rows and valid messages use complete Beijing month-day and 24-hour time', () => {
  assert.deepEqual(withMessageTimes([]), []);
  for (const [value, expected] of [
    ['2026-09-05T11:31:00', '09-05 11:31'],
    ['2026-09-08T14:22:00', '09-08 14:22'],
    ['2026-12-21T19:24:00', '12-21 19:24'],
    ['2026-01-02T00:03:59', '01-02 00:03'],
    ['2025-09-05T11:31:00', '09-05 11:31'],
  ]) assert.deepEqual(labels([message(value)]), [expected]);
});

test('grouping uses the exact millisecond gap before formatting to minutes', () => {
  const first = message('2026-09-05T11:31:00');
  for (const [gap, expected] of [
    [299000, ''], [299999, ''], [300000, '09-05 11:36'], [300001, '09-05 11:36'], [301000, '09-05 11:36'],
  ]) {
    assert.deepEqual(labels([first, { createdTimestamp: first.createdTimestamp + gap }]), ['09-05 11:31', expected]);
  }
  assert.deepEqual(labels([
    message('2026-09-05T11:31:59'), message('2026-09-05T11:36:58'),
  ]), ['09-05 11:31', '']);
});

test('the previous adjacent message controls grouping regardless of sender, type or sending state', () => {
  assert.deepEqual(labels([
    message('2026-09-05T11:31:00', { from: 'other', type: 'text', status: 'sent' }),
    message('2026-09-05T11:35:00', { from: 'me', type: 'image', status: 'failed' }),
    message('2026-09-05T11:39:00', { from: 'me', type: 'text', status: 'sending' }),
  ]), ['09-05 11:31', '', '']);
});

test('Beijing midnight and year boundaries show time even with gaps under five minutes', () => {
  assert.deepEqual(labels([
    message('2026-09-08T23:59:00'), message('2026-09-09T00:01:00'),
  ]), ['09-08 23:59', '09-09 00:01']);
  assert.deepEqual(labels([
    message('2025-12-31T23:59:00'), message('2026-01-01T00:01:00'),
  ]), ['12-31 23:59', '01-01 00:01']);
});

test('invalid raw times never use other timestamp fields and the next valid message restores a time label', () => {
  const valid = timestamp('2026-09-05T11:31:00');
  for (const invalid of [undefined, null, '', String(valid), 'invalid', 0, -1, NaN, Infinity, -Infinity, 1e20, {}, new Date(valid)]) {
    const messages = [
      { createdTimestamp: invalid, createdAt: valid, time: '11:30', text: '历史消息' },
      { createdTimestamp: valid },
      { createdTimestamp: invalid, createdAt: valid, time: '11:32', text: '仍可阅读' },
      { createdTimestamp: valid + 60000 },
    ];
    assert.deepEqual(labels(messages), ['', '09-05 11:31', '', '09-05 11:32']);
    assert.equal(withMessageTimes(messages)[2].text, '仍可阅读');
  }
});

test('presentation returns copies without sorting, changing business fields or adding messages', () => {
  const image = Object.freeze({ width: 30, height: 40 });
  const messages = Object.freeze([
    Object.freeze(message('2026-09-05T11:31:00', { id: 'B', clientMessageId: 'send-1', image })),
    Object.freeze(message('2025-09-05T11:31:00', { id: 'A', timeLabel: 'old label', text: '较早消息' })),
  ]);
  const result = withMessageTimes(messages);
  assert.deepEqual(result.map(item => item.id), ['B', 'A']);
  assert.deepEqual(result.map(item => item.timeLabel), ['09-05 11:31', '09-05 11:31']);
  assert.equal(result.length, messages.length);
  assert.notEqual(result, messages);
  result.forEach((item, index) => assert.notEqual(item, messages[index]));
  assert.equal(result[0].image, image);
  assert.equal(result[0].clientMessageId, 'send-1');
  assert.equal(messages[0].timeLabel, undefined);
  assert.equal(messages[1].timeLabel, 'old label');
});

test('prepending history recomputes the old first label using its new neighbor', () => {
  const recent = message('2026-09-05T11:35:00', { id: 'recent' });
  assert.deepEqual(labels([recent]), ['09-05 11:35']);
  assert.deepEqual(labels([message('2026-09-05T11:33:00'), recent]), ['09-05 11:33', '']);
  assert.deepEqual(labels([message('2026-09-05T11:30:00'), recent]), ['09-05 11:30', '09-05 11:35']);
});

test('formatting and natural-day grouping are identical across host timezones', () => {
  const script = `
    const { withMessageTimes } = require(process.argv[1]);
    const messages = ['2026-09-08T15:59:00Z', '2026-09-08T16:03:00Z', '2026-09-08T16:04:00Z']
      .map(value => ({ createdTimestamp: Date.parse(value) }));
    process.stdout.write(JSON.stringify(withMessageTimes(messages).map(item => item.timeLabel)));
  `;
  for (const zone of ['UTC', 'Asia/Shanghai', 'America/New_York', 'Pacific/Kiritimati']) {
    const output = execFileSync(process.execPath, ['-e', script, require.resolve('../miniprogram/utils/chat-presentation')], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    });
    assert.deepEqual(JSON.parse(output), ['09-08 23:59', '09-09 00:03', ''], zone);
  }
});
