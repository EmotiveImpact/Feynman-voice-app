// onnxruntime-react-native's own config plugin adds its pod at
// ../node_modules/onnxruntime-react-native, which is wrong in this monorepo
// (npm hoists it to the root node_modules), so pod install fails on EAS.
// This is the same plugin with the path worked out from where the package
// really is.
//
// It also pins onnxruntime-c to ./onnxruntime-c.podspec, because the
// official spec's download host is dead (see the comment in that file).
const path = require("path");
const fs = require("fs");
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const pkgDir = path.dirname(require.resolve("onnxruntime-react-native/package.json"));

module.exports = function withOnnxruntime(config) {
  config = withAppBuildGradle(config, (c) => {
    c.modResults.contents = mergeContents({
      src: c.modResults.contents,
      newSrc: "    implementation project(':onnxruntime-react-native')",
      tag: "onnxruntime-react-native",
      anchor: /^dependencies[ \t]*\{$/,
      offset: 1,
      comment: "    //",
    }).contents;
    return c;
  });

  return withDangerousMod(config, [
    "ios",
    (c) => {
      const iosRoot = c.modRequest.platformProjectRoot;
      const podfile = path.join(iosRoot, "Podfile");
      const rel = path.relative(iosRoot, pkgDir).split(path.sep).join("/");
      const ortSpec = path
        .relative(iosRoot, path.join(__dirname, "onnxruntime-c.podspec"))
        .split(path.sep)
        .join("/");
      const contents = fs.readFileSync(podfile, "utf8");
      fs.writeFileSync(
        podfile,
        mergeContents({
          src: contents,
          newSrc: [
            `  pod 'onnxruntime-react-native', :path => '${rel}'`,
            `  pod 'onnxruntime-c', :podspec => '${ortSpec}'`,
          ].join("\n"),
          tag: "onnxruntime-react-native",
          anchor: /^target.+do$/,
          offset: 1,
          comment: "  #",
        }).contents,
      );
      return c;
    },
  ]);
};
