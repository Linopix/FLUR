import SwiftUI
import WidgetKit

private enum WidgetPalette {
    static let background = Color(red: 0.067, green: 0.075, blue: 0.090)
    static let surface = Color(red: 0.102, green: 0.114, blue: 0.137)
    static let gold = Color(red: 0.855, green: 0.682, blue: 0.337)
    static let text = Color(red: 0.945, green: 0.941, blue: 0.922)
    static let muted = Color(red: 0.655, green: 0.675, blue: 0.714)
}

private struct FLUREntry: TimelineEntry {
    let date: Date
    let snapshot: SharedSnapshot?
}

private struct FLURProvider: TimelineProvider {
    func placeholder(in context: Context) -> FLUREntry { FLUREntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (FLUREntry) -> Void) {
        completion(FLUREntry(date: .now, snapshot: SharedScheduleStore.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FLUREntry>) -> Void) {
        let now = Date.now
        let entry = FLUREntry(date: now, snapshot: SharedScheduleStore.load())
        // WidgetKit decides exact refresh times. The view's date-relative text updates continuously while visible.
        completion(Timeline(entries: [entry], policy: .after(Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900))))
    }
}

private struct FLURWidgetView: View {
    let entry: FLUREntry
    @Environment(\.widgetFamily) private var family
    private var minute: Int { Calendar.current.component(.hour, from: entry.date) * 60 + Calendar.current.component(.minute, from: entry.date) }
    private var active: Lesson? { entry.snapshot?.today.first { $0.startMin <= minute && minute < $0.endMin && $0.status != "cancelled" } }
    private var next: Lesson? { entry.snapshot?.today.first { $0.startMin > minute && $0.status != "cancelled" } }
    private var tomorrow: Lesson? { entry.snapshot?.tomorrow.first }
    private var departure: String? { entry.snapshot?.outbound?.legs?.first?.from?.departure ?? entry.snapshot?.outbound?.legs?.first?.from?.scheduledDeparture }
    private var deadline: Int? {
        if let active { return active.endMin }
        if let next, let departure, let value = parse(departure), value > minute, value <= next.startMin { return value }
        if let next { return next.startMin }
        return tomorrow.map { 1440 + $0.startMin }
    }
    private var deadlineDate: Date? {
        guard let deadline else { return nil }
        let base = Calendar.current.date(byAdding: .day, value: deadline / 1440, to: entry.date) ?? entry.date
        return Calendar.current.date(bySettingHour: (deadline % 1440) / 60, minute: deadline % 60, second: 0, of: base)
    }
    private var title: String { active?.subject ?? next?.subject ?? tomorrow?.subject ?? "Unterricht geschafft" }
    private var label: String { active != nil ? "STUNDE ENDET IN" : next != nil ? (deadline == (departure.flatMap(parse)) ? "AUFBRUCH IN" : "NÄCHSTE STUNDE") : tomorrow != nil ? "NÄCHSTER SCHULTAG" : "AKTUELL" }
    private var remaining: String {
        guard let deadline else { return "—" }
        let delta = max(0, deadline - minute)
        return delta == 0 ? "jetzt" : delta >= 60 ? "\(delta / 60) Std. \(delta % 60) Min." : "\(delta) Min."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 8 : 11) {
            HStack {
                VStack(spacing: -4) { Text("FL"); Text("UR") }
                    .font(.system(size: 12, weight: .black, design: .rounded).monospaced()).foregroundStyle(WidgetPalette.gold)
                Spacer()
                Text(entry.date, style: .time).font(.system(.caption, design: .rounded).weight(.semibold).monospacedDigit()).foregroundStyle(WidgetPalette.muted)
            }
            Text(label).font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1).foregroundStyle(WidgetPalette.muted).lineLimit(1)
            if let deadlineDate {
                Text(timerInterval: entry.date...deadlineDate, countsDown: true)
                    .font(.system(size: family == .systemSmall ? 25 : 31, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(WidgetPalette.text).minimumScaleFactor(0.72).lineLimit(1)
            } else {
                Text(remaining).font(.system(size: family == .systemSmall ? 25 : 31, weight: .semibold, design: .rounded).monospacedDigit()).foregroundStyle(WidgetPalette.text).minimumScaleFactor(0.72).lineLimit(1)
            }
            Text(title).font(.system(size: family == .systemSmall ? 16 : 20, weight: .semibold, design: .serif)).foregroundStyle(WidgetPalette.gold).lineLimit(1)
            if let active { Text("Bis \(clock(active.endMin)) · \(active.room.isEmpty ? "Raum offen" : "Raum \(active.room)")").font(.system(size: 11)).foregroundStyle(WidgetPalette.muted).lineLimit(1) }
            else if let next { Text("\(clock(next.startMin)) · \(next.room.isEmpty ? "Raum offen" : "Raum \(next.room)")").font(.system(size: 11)).foregroundStyle(WidgetPalette.muted).lineLimit(1) }
            else if let tomorrow { Text("Morgen · \(clock(tomorrow.startMin))").font(.system(size: 11)).foregroundStyle(WidgetPalette.muted).lineLimit(1) }
            else { Text("Stundenplan lokal gespeichert").font(.system(size: 11)).foregroundStyle(WidgetPalette.muted).lineLimit(1) }
        }.padding(family == .systemSmall ? 13 : 16).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .containerBackground(WidgetPalette.background, for: .widget)
    }
}

struct FLURCurrentWidget: Widget {
    let kind = "FLURCurrentWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FLURProvider()) { entry in FLURWidgetView(entry: entry) }
            .configurationDisplayName("FLUR Aktuell")
            .description("Deine aktuelle Stunde oder der Countdown bis zur nächsten Abfahrt.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

@main struct FLURWidgetBundle: WidgetBundle {
    var body: some Widget { FLURCurrentWidget() }
}

private func clock(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }
private func parse(_ value: String) -> Int? {
    let parts = value.split(separator: ":")
    guard parts.count > 1, let hour = Int(parts[0]), let minute = Int(parts[1]) else { return nil }
    return hour * 60 + minute
}
