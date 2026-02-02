// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "TabAgent",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "TabAgent", targets: ["TabAgent"])
    ],
    targets: [
        .executableTarget(
            name: "TabAgent",
            path: "TabAgent/Sources/TabAgent"
        )
    ]
)
