/**
 * Universal Response Helper for Vercel Serverless, Node.js, and Bun
 */
export function sendResponse(res, statusCode, data) {
  const payload = JSON.stringify(data);

  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (typeof res.status === 'function') {
      try {
        return res.status(statusCode).json ? res.status(statusCode).json(data) : res.end(payload);
      } catch (e) {
        res.statusCode = statusCode;
        return res.end(payload);
      }
    }
    res.statusCode = statusCode;
    return res.end(payload);
  }

  // Web Standard Response (Bun / Fetch API / Edge)
  return new Response(payload, {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export async function parseBody(req) {
  if (!req) return {};
  if (typeof req.json === 'function') {
    try {
      return await req.json();
    } catch (e) {
      return {};
    }
  }
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {};
      }
    }
    return req.body;
  }
  return {};
}
