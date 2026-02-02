import Foundation

class RelayConnection: NSObject {
    enum Status: Equatable {
        case disconnected
        case connecting
        case connected
        case error(String)
    }

    var onStatusChange: ((Status) -> Void)?
    var onMessage: ((Data) -> Void)?

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    private var status: Status = .disconnected {
        didSet {
            onStatusChange?(status)
        }
    }

    private let relayURL = URL(string: "ws://localhost:9876")!
    private var reconnectTimer: Timer?

    override init() {
        super.init()
        urlSession = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
    }

    func connect() {
        guard status != .connecting && status != .connected else { return }

        status = .connecting

        var request = URLRequest(url: relayURL)
        request.setValue("safari", forHTTPHeaderField: "x-client-type")

        webSocket = urlSession.webSocketTask(with: request)
        webSocket?.resume()

        receiveMessage()
    }

    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        status = .disconnected
    }

    func send(_ message: [String: Any]) {
        guard status == .connected else {
            print("Cannot send - not connected")
            return
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: message)
            webSocket?.send(.data(data)) { [weak self] error in
                if let error = error {
                    print("Send error: \(error)")
                    self?.handleDisconnect()
                }
            }
        } catch {
            print("JSON serialization error: \(error)")
        }
    }

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    self?.onMessage?(data)
                case .string(let text):
                    if let data = text.data(using: .utf8) {
                        self?.onMessage?(data)
                    }
                @unknown default:
                    break
                }
                // Continue receiving
                self?.receiveMessage()

            case .failure(let error):
                print("Receive error: \(error)")
                self?.handleDisconnect()
            }
        }
    }

    private func handleDisconnect() {
        status = .disconnected
        webSocket = nil

        // Auto-reconnect after 5 seconds
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
}

extension RelayConnection: URLSessionWebSocketDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        status = .connected
        print("Connected to relay server")
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        handleDisconnect()
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            status = .error(error.localizedDescription)
        }
        handleDisconnect()
    }
}
