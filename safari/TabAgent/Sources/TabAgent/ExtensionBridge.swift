import Foundation
import SafariServices

class ExtensionBridge {
    private weak var relayConnection: RelayConnection?
    private var pendingRequests: [String: (([String: Any]) -> Void)] = [:]

    init(relayConnection: RelayConnection) {
        self.relayConnection = relayConnection

        relayConnection.onMessage = { [weak self] data in
            self?.handleRelayMessage(data)
        }
    }

    private func handleRelayMessage(_ data: Data) {
        guard let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("Invalid JSON from relay")
            return
        }

        // Forward command to Safari extension
        forwardToExtension(message)
    }

    private func forwardToExtension(_ command: [String: Any]) {
        // Get the extension's bundle identifier
        let extensionBundleId = Bundle.main.bundleIdentifier.map { "\($0).Extension" } ?? ""

        SFSafariApplication.getActiveWindow { window in
            window?.getActiveTab { tab in
                tab?.getActivePage { page in
                    // Send message to content script via the page
                    page?.dispatchMessageToScript(
                        withName: "command",
                        userInfo: command
                    )
                }
            }
        }
    }

    func handleExtensionResponse(_ response: [String: Any]) {
        // Forward response back to relay
        relayConnection?.send(response)
    }
}
