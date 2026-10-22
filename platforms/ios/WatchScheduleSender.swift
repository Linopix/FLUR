import Foundation
import WatchConnectivity

enum WatchScheduleSender {
    private static let relay = WatchSessionRelay()

    static func sendLatestSnapshot() {
        guard let data = UserDefaults(suiteName: SharedScheduleStore.appGroup)?
            .data(forKey: SharedScheduleStore.key) else { return }
        relay.send(data)
    }
}

private final class WatchSessionRelay: NSObject, WCSessionDelegate {
    private var pending: Data?

    func send(_ data: Data) {
        guard WCSession.isSupported() else { return }
        pending = data
        let session = WCSession.default
        session.delegate = self
        if session.activationState == .activated { flush(session) }
        else { session.activate() }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if activationState == .activated { flush(session) }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }

    private func flush(_ session: WCSession) {
        guard let pending else { return }
        try? session.updateApplicationContext([SharedScheduleStore.key: pending])
        self.pending = nil
    }
}
