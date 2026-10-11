const { getDefaultConfig } = require("expo/metro-config");

const path = require("node:path");
const { createMiddleware } = require("./server/shared-walk.cjs");
const config = getDefaultConfig(__dirname);
const sharedWalk = createMiddleware(
  path.join(__dirname, "../tmp/shared-walk/state.json"),
);
config.server.enhanceMiddleware = (middleware) => (req, res, next) =>
  sharedWalk(req, res, () => middleware(req, res, next));
module.exports = config;
