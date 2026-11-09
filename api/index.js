/**
 * Vercel Serverless Function Handler for UjianKita
 * Routes all /api/* requests to the central requestHandler in dashboard/server.js
 */

const requestHandler = require('../dashboard/server.js');

module.exports = (req, res) => {
  return requestHandler(req, res);
};
