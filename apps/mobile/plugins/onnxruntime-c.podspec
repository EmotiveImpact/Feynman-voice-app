# ONNX Runtime's own CocoaPods spec downloads from download.onnxruntime.ai,
# which stopped working around 2026-11-20 (its CDN now serves the wrong
# certificate and the files are gone), so every clean iOS build failed at
# "Install pods". This spec takes the same static iPhone library from
# Microsoft's official NuGet package instead, checked against a fixed
# SHA-256, and lays it out the way the original pod did.
Pod::Spec.new do |s|
  s.name     = "onnxruntime-c"
  s.version  = "1.24.3"
  s.summary  = "ONNX Runtime C/C++ Pod (from the official NuGet package)"
  s.homepage = "https://github.com/microsoft/onnxruntime"
  s.license  = { :type => "MIT", :file => "LICENSE" }
  s.authors  = { "ONNX Runtime" => "onnxruntime@microsoft.com" }

  s.source = {
    :http   => "https://api.nuget.org/v3-flatcontainer/microsoft.ml.onnxruntime/#{s.version}/microsoft.ml.onnxruntime.#{s.version}.nupkg",
    :type   => "zip",
    :sha256 => "e4ab3b236c1b803e1e7167fe9a75caa1b82a2fd4ae82abbd130937c07517bcdb",
  }

  s.prepare_command = <<-CMD
    set -e
    unzip -q -o runtimes/ios/native/onnxruntime.xcframework.zip -d .
    mkdir -p Headers
    cp onnxruntime.xcframework/ios-arm64/onnxruntime.framework/Headers/*.h Headers/
  CMD

  s.platforms           = { :ios => "15.1" }
  s.vendored_frameworks = "onnxruntime.xcframework"
  s.static_framework    = true
  s.weak_frameworks     = ["CoreML"]
  s.frameworks          = ["CoreFoundation", "Foundation", "Network", "Security", "SystemConfiguration", "UIKit"]
  s.source_files        = "Headers/*.h"
  s.preserve_paths      = ["LICENSE"]
  s.libraries           = "c++"
  s.pod_target_xcconfig = { "OTHER_CPLUSPLUSFLAGS" => "-fvisibility=hidden -fvisibility-inlines-hidden" }
end
