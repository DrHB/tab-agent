import AppKit
import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var relayConnection: RelayConnection!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide dock icon - menu bar only
        NSApp.setActivationPolicy(.accessory)

        // Create status item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "globe", accessibilityDescription: "Tab Agent")
            button.image?.isTemplate = true
        }

        // Initialize relay connection
        relayConnection = RelayConnection()
        relayConnection.onStatusChange = { [weak self] status in
            DispatchQueue.main.async {
                self?.updateStatusIcon(status)
            }
        }

        // Build menu
        setupMenu()

        // Connect to relay
        relayConnection.connect()
    }

    private func setupMenu() {
        let menu = NSMenu()

        // Status item
        let statusMenuItem = NSMenuItem(title: "Status: Disconnected", action: nil, keyEquivalent: "")
        statusMenuItem.tag = 100 // For updating later
        menu.addItem(statusMenuItem)

        menu.addItem(NSMenuItem.separator())

        // Reconnect
        menu.addItem(NSMenuItem(title: "Reconnect", action: #selector(reconnect), keyEquivalent: "r"))

        // Open Safari Extensions
        menu.addItem(NSMenuItem(title: "Open Safari Extensions...", action: #selector(openSafariExtensions), keyEquivalent: ""))

        menu.addItem(NSMenuItem.separator())

        // Quit
        menu.addItem(NSMenuItem(title: "Quit Tab Agent", action: #selector(quit), keyEquivalent: "q"))

        self.statusItem.menu = menu
    }

    private func updateStatusIcon(_ status: RelayConnection.Status) {
        guard let button = statusItem.button else { return }

        let symbolName: String
        let statusText: String

        switch status {
        case .connected:
            symbolName = "globe"
            statusText = "Status: Connected"
        case .disconnected:
            symbolName = "globe.badge.chevron.backward"
            statusText = "Status: Disconnected"
        case .connecting:
            symbolName = "globe.badge.chevron.backward"
            statusText = "Status: Connecting..."
        case .error(let message):
            symbolName = "exclamationmark.triangle"
            statusText = "Status: Error - \(message)"
        }

        button.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: "Tab Agent")
        button.image?.isTemplate = true

        if let menu = statusItem.menu, let item = menu.item(withTag: 100) {
            item.title = statusText
        }
    }

    @objc private func reconnect() {
        relayConnection.connect()
    }

    @objc private func openSafariExtensions() {
        // Open Safari Extensions preferences
        if let url = URL(string: "x-apple.systempreferences:com.apple.Safari-Extensions-Preferences") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
