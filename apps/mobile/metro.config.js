// Let Metro bundle the Kitten TTS model and voice table as assets.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("onnx", "bin");

// The design preview (see preview/README.md) draws the real screens in a
// browser. Phone-only modules are swapped for stand-ins there, and only there.
if (process.env.FENNY_PREVIEW) {
  const stubs = {
    "expo-file-system": path.join(__dirname, "preview/stubs/file-system.js"),
    "onnxruntime-react-native": path.join(__dirname, "preview/stubs/empty.js"),
    "react-native-document-scanner-plugin": path.join(__dirname, "preview/stubs/empty.js"),
  };
  const next = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (ctx, name, platform) => {
    if (platform === "web" && name.includes("assets/kitten/")) return { type: "sourceFile", filePath: stubs["onnxruntime-react-native"] };
    if (platform === "web" && stubs[name]) return { type: "sourceFile", filePath: stubs[name] };
    return (next ?? ctx.resolveRequest)(ctx, name, platform);
  };
}
module.exports = config;
