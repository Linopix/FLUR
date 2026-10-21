import SwiftUI
import WidgetKit

private struct WatchEntry: TimelineEntry { let date: Date; let snapshot: SharedSnapshot? }
private struct WatchProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchEntry { WatchEntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (WatchEntry) -> Void) { completion(WatchEntry(date: .now, snapshot: SharedScheduleStore.load())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchEntry>) -> Void) {
        let entry = WatchEntry(date: .now, snapshot: SharedScheduleStore.load())
        completion(Timeline(entries: [entry], policy: .after(Date.now.addingTimeInterval(900))))
    }
}
private struct WatchWidgetView: View {
    let entry: WatchEntry
    private var minute: Int { Calendar.current.component(.hour, from: entry.date) * 60 + Calendar.current.component(.minute, from: entry.date) }
    private var active: Lesson? { entry.snapshot?.today.first { $0.startMin <= minute && minute < $0.endMin && $0.status != "cancelled" } }
    private var next: Lesson? { entry.snapshot?.today.first { $0.startMin > minute && $0.status != "cancelled" } }
    private var tomorrow: Lesson? { entry.snapshot?.tomorrow.first }
    private var tripTime: String? { entry.snapshot?.outbound?.legs?.first?.from?.departure ?? entry.snapshot?.outbound?.legs?.first?.from?.scheduledDeparture }
    private var deadline: Int? { if let active { return active.endMin }; if let next { return tripTime.flatMap(parse).map { $0 > minute && $0 <= next.startMin ? $0 : next.startMin } ?? next.startMin }; return tomorrow.map { 1440 + $0.startMin } }
    private var deadlineDate: Date? {
        guard let deadline else { return nil }
        let day = Calendar.current.date(byAdding: .day, value: deadline / 1440, to: entry.date) ?? entry.date
        return Calendar.current.date(bySettingHour: (deadline % 1440) / 60, minute: deadline % 60, second: 0, of: day)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack { VStack(spacing: -3) { Text("FL"); Text("UR") }.font(.system(size: 11, weight: .black, design: .rounded).monospaced()).foregroundStyle(WatchWidgetPalette.gold); Spacer(); Text(entry.date, style: .time).font(.system(.caption2, design: .rounded).monospacedDigit()).foregroundStyle(WatchWidgetPalette.muted) }
            if let lesson = active ?? next ?? tomorrow {
                Text(active == nil && next == nil ? "NÄCHSTER SCHULTAG" : active == nil && deadline == tripTime.flatMap(parse) ? "AUFBRUCH" : active == nil ? "ALS NÄCHSTES" : "STUNDE ENDET")
                    .font(.system(size: 9, weight: .bold)).tracking(1).foregroundStyle(WatchWidgetPalette.muted)
                Text(lesson.subject).font(.system(size: 17, weight: .semibold, design: .serif)).foregroundStyle(WatchWidgetPalette.gold).lineLimit(1)
                HStack(spacing: 6) {
                    Text(tomorrow != nil && active == nil && next == nil ? "Morgen · \(clock(lesson.startMin))" : clock(lesson.startMin))
                    if let deadlineDate { Text(timerInterval: entry.date...deadlineDate, countsDown: true) }
                    else { Text(countdown(deadline, minute)) }
                }.font(.system(size: 11, weight: .medium, design: .rounded).monospacedDigit()).foregroundStyle(WatchWidgetPalette.text).lineLimit(1)
            } else { Text("FLUR öffnen, um den aktuellen Stundenplan zu synchronisieren.").font(.system(size: 12)).foregroundStyle(WatchWidgetPalette.text).lineLimit(3) }
        }.padding(10).containerBackground(.black, for: .widget)
    }
}
private enum WatchWidgetPalette {
    static let gold = Color(red: 0.855, green: 0.682, blue: 0.337)
    static let text = Color(red: 0.945, green: 0.941, blue: 0.922)
    static let muted = Color(red: 0.655, green: 0.675, blue: 0.714)
}
struct FLURWatchWidget: Widget {
    let kind = "FLURWatchWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WatchProvider()) { entry in WatchWidgetView(entry: entry) }
            .configurationDisplayName("FLUR Aktuell")
            .description("Stunde oder Aufbruch direkt auf deinem Zifferblatt.")
            .supportedFamilies([.accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}
@main struct FLURWatchWidgetBundle: WidgetBundle { var body: some Widget { FLURWatchWidget() } }
private func clock(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }
private func parse(_ value: String) -> Int? { let parts = value.split(separator: ":"); guard parts.count > 1, let hour = Int(parts[0]), let minute = Int(parts[1]) else { return nil }; return hour * 60 + minute }
private func countdown(_ target: Int?, _ minute: Int) -> String { guard let target else { return "—" }; let delta = max(0, target - minute); return delta == 0 ? "jetzt" : delta >= 60 ? "\(delta / 60)h \(delta % 60)m" : "\(delta) Min." }
