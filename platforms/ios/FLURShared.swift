import Foundation
import WidgetKit

struct Lesson: Identifiable, Codable {
    let id: String
    let startMin, endMin: Int
    let subject, teacher, room, info, status: String
}
struct Itinerary: Identifiable, Decodable {
    var id: String { startTime ?? UUID().uuidString }
    let startTime, endTime: String?
    let legs: [Leg]?
}
struct Leg: Decodable, Identifiable {
    var id: String { "\(from?.name ?? "")-\(to?.name ?? "")-\(mode ?? "")" }
    let mode, routeShortName, displayName: String?
    let cancelled: Bool?
    let from, to: StopTime?
}
struct StopTime: Decodable { let name, departure, arrival, scheduledDeparture, scheduledArrival, description, track: String?; let cancelled: Bool? }
struct SharedSnapshot: Codable {
    let today: [Lesson]
    let tomorrow: [Lesson]
    let outbound: SharedTrip?
    let departures: [SharedTrip]
    let savedAt: Date
}
struct SharedTrip: Codable, Identifiable {
    var id: String { startTime ?? "trip" }
    let startTime, endTime: String?
    let legs: [SharedLeg]?
    init(_ trip: Itinerary) {
        startTime = trip.startTime; endTime = trip.endTime
        legs = trip.legs?.map { SharedLeg($0) }
    }
}
struct SharedLeg: Codable, Identifiable {
    var id: String { "\(from?.name ?? "")-\(to?.name ?? "")-\(mode ?? "")" }
    let mode, routeShortName, displayName: String?
    let cancelled: Bool?
    let from, to: SharedStop?
    init(_ leg: Leg) {
        mode = leg.mode; routeShortName = leg.routeShortName; displayName = leg.displayName
        cancelled = leg.cancelled
        from = leg.from.map { SharedStop($0) }; to = leg.to.map { SharedStop($0) }
    }
}
struct SharedStop: Codable {
    let name, departure, arrival, scheduledDeparture, scheduledArrival, description, track: String?
    let cancelled: Bool?
    init(_ stop: StopTime) {
        name = stop.name; departure = stop.departure; arrival = stop.arrival
        scheduledDeparture = stop.scheduledDeparture; scheduledArrival = stop.scheduledArrival
        description = stop.description; track = stop.track; cancelled = stop.cancelled
    }
}
enum SharedScheduleStore {
    static let appGroup = "group.de.linopix.flur"
    static let key = "flur.shared.snapshot.v1"
    static func save(today: [Lesson], tomorrow: [Lesson], outbound: Itinerary?, departures: [Itinerary], savedAt: Date) {
        let snapshot = SharedSnapshot(today: today, tomorrow: tomorrow, outbound: outbound.map(SharedTrip.init), departures: departures.map(SharedTrip.init), savedAt: savedAt)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults(suiteName: appGroup)?.set(data, forKey: key)
        #if os(iOS)
        WidgetCenter.shared.reloadTimelines(ofKind: "FLURCurrentWidget")
        #endif
    }
    static func load() -> SharedSnapshot? {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(SharedSnapshot.self, from: data)
    }
}

