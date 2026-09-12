function httpResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  };
}

function parseHttpEvent(event = {}) {
  if (!event.httpMethod) return null;
  if (event.httpMethod === 'OPTIONS') return { preflight: true };
  const rawBody = event.body || '{}';
  try {
    return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch (err) {
    return { action: '', data: {}, parseError: true };
  }
}

module.exports = { httpResponse, parseHttpEvent };
