// expo default
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      filePath: path.resolve(__dirname, "shims/react-native-maps.web.tsx"),
      type: "sourceFile",
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

const { createMiddleware } = require("./features/mckinney/social/relay.cjs");
const signalMiddleware = createMiddleware();
const originalEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = originalEnhance ? originalEnhance(middleware, server) : middleware;
  return (req, res, next) => signalMiddleware(req, res, () => enhanced(req, res, next));
};

module.exports = config;
