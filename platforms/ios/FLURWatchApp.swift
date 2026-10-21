import SwiftUI
import WidgetKit
import WatchConnectivity

@main
struct FLURWatchApp: App {
    init() { WatchScheduleReceiver.shared.activate() }
    var body: some Scene { WindowGroup { WatchTimelineRoot() } }
}

private final class WatchScheduleReceiver: NSObject, WCSessionDelegate {
    static let shared = WatchScheduleReceiver()
    private override init() { super.init() }
    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let data = session.receivedApplicationContext[SharedScheduleStore.key] as? Data { accept(data) }
    }
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        if let data = applicationContext[SharedScheduleStore.key] as? Data { accept(data) }
    }
    private func accept(_ data: Data) {
        guard let value = try? JSONDecoder().decode(SharedSnapshot.self, from: data) else { return }
        UserDefaults(suiteName: SharedScheduleStore.appGroup)?.set(data, forKey: SharedScheduleStore.key)
        WidgetCenter.shared.reloadTimelines(ofKind: "FLURWatchWidget")
        _ = value
    }
}

private struct WatchTimelineRoot: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in WatchCurrentView(now: context.date) }
    }
}

private struct WatchCurrentView: View {
    let now: Date
    private var minute: Int { Calendar.current.component(.hour, from: now) * 60 + Calendar.current.component(.minute, from: now) }
    private var snapshot: SharedSnapshot? { SharedScheduleStore.load() }
    private var active: Lesson? { snapshot?.today.first { $0.startMin <= minute && minute < $0.endMin && $0.status != "cancelled" } }
    private var next: Lesson? { snapshot?.today.first { $0.startMin > minute && $0.status != "cancelled" } }
    private var isAfterSchool: Bool { active == nil && next == nil && !(snapshot?.today.isEmpty ?? true) }
    private var target: Int? {
        if let active { return active.endMin }
        if let next, let outbound, outbound > minute, outbound <= next.startMin { return outbound }
        if let next { return next.startMin }
        if isAfterSchool, let home, home > minute { return home }
        if let first = snapshot?.tomorrow.first { return 1440 + first.startMin }
        return nil
    }
    private var outboundStop: SharedStop? {
        guard let legs = snapshot?.outbound?.legs, let first = legs.first else { return nil }
        return first.from
    }
    private var homeStop: SharedStop? {
        guard let trips = snapshot?.departures, let trip = trips.first, let legs = trip.legs, let first = legs.first else { return nil }
        return first.from
    }
    private var outbound: Int? { outboundStop?.departure.flatMap(parse) ?? outboundStop?.scheduledDeparture.flatMap(parse) }
    private var home: Int? { homeStop?.departure.flatMap(parse) ?? homeStop?.scheduledDeparture.flatMap(parse) }
    private var title: String { active?.subject ?? next?.subject ?? (isAfterSchool && home != nil ? "Heimweg" : snapshot?.tomorrow.first?.subject ?? "FLUR") }
    private var label: String { active != nil ? "ENDET IN" : next != nil ? (target == outbound ? "AUFBRUCH IN" : "NÄCHSTE STUNDE") : isAfterSchool && home != nil ? "ABFAHRT IN" : snapshot?.tomorrow.isEmpty == false ? "NÄCHSTER SCHULTAG" : "DEIN TAG" }
    private var countdown: String {
        guard let target else { return "–" }
        let delta = max(0, target - minute)
        return delta == 0 ? "Jetzt" : delta >= 60 ? "\(delta / 60)h \(delta % 60)m" : "\(delta) Min."
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 5) { VStack(spacing: -3) { Text("FL"); Text("UR") }.font(.system(size: 15, weight: .black, design: .rounded).monospaced()).foregroundStyle(WatchPalette.gold); Spacer(); Text(now, style: .time).font(.system(.caption2, design: .rounded).monospacedDigit()).foregroundStyle(WatchPalette.muted) }
                Text(label).font(.system(size: 10, weight: .bold)).tracking(1).foregroundStyle(WatchPalette.muted)
                Text(countdown).font(.system(size: 27, weight: .semibold, design: .rounded).monospacedDigit()).foregroundStyle(WatchPalette.text).minimumScaleFactor(0.75).lineLimit(1)
                Text(title).font(.system(size: 18, weight: .semibold, design: .serif)).foregroundStyle(WatchPalette.gold).lineLimit(2)
                if let lesson = active ?? next { Text("\(clock(lesson.startMin))–\(clock(lesson.endMin))").font(.system(.caption2, design: .rounded)).foregroundStyle(WatchPalette.muted) }
                else if let lesson = snapshot?.tomorrow.first { Text("Morgen · \(clock(lesson.startMin))").font(.system(.caption2, design: .rounded)).foregroundStyle(WatchPalette.muted) }
                else if snapshot == nil { Text("FLUR auf dem iPhone öffnen, um den Plan zu laden.").font(.system(size: 11)).foregroundStyle(WatchPalette.muted) }
                if let departure = isAfterSchool ? home : outbound, (active != nil || next != nil || isAfterSchool) {
                    Divider().overlay(WatchPalette.muted.opacity(0.3))
                    HStack { Image(systemName: "tram.fill").foregroundStyle(WatchPalette.gold); Text(isAfterSchool ? "Heimfahrt" : "Abfahrt").foregroundStyle(WatchPalette.muted); Spacer(); Text(clock(departure)).foregroundStyle(WatchPalette.text).monospacedDigit() }.font(.system(size: 11, weight: .medium))
                }
            }.padding(.horizontal, 4)
        }
    }
}

private enum WatchPalette {
    static let gold = Color(red: 0.855, green: 0.682, blue: 0.337)
    static let text = Color(red: 0.945, green: 0.941, blue: 0.922)
    static let muted = Color(red: 0.655, green: 0.675, blue: 0.714)
}
private func parse(_ value: String) -> Int? {
    let parts = value.split(separator: ":")
    guard parts.count > 1, let hour = Int(parts[0]), let minute = Int(parts[1]) else { return nil }
    return hour * 60 + minute
}
private func clock(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }
