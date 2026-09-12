const BEIJING_OFFSET = 8 * 60 * 60 * 1000;
const TIME_GAP = 5 * 60 * 1000;

function messageTime(timestamp) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp + BEIJING_OFFSET);
  if (!Number.isFinite(date.getTime())) return null;
  const pad = value => String(value).padStart(2, '0');
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  return {
    timestamp,
    dateKey: `${date.getUTCFullYear()}-${month}-${day}`,
    label: `${month}-${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
  };
}

function withMessageTimes(messages) {
  let previous = null;
  return messages.map(item => {
    const current = messageTime(item.createdTimestamp);
    const showTime = current && (!previous || current.timestamp - previous.timestamp >= TIME_GAP || current.dateKey !== previous.dateKey);
    previous = current;
    return { ...item, timeLabel: showTime ? current.label : '' };
  });
}

module.exports = { withMessageTimes };
