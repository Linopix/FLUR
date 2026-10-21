import SwiftUI
import Security
import Combine
import WatchConnectivity

@main
struct FLURApp: App {
    @StateObject private var model = FLURModel()
    var body: some Scene { WindowGroup { DashboardView().environmentObject(model).task { await model.refresh() } } }
}

struct ScheduleCache: Codable { let today: [Lesson]; let tomorrow: [Lesson]; let savedAt: Date }
@MainActor final class FLURModel: ObservableObject {
    @Published var lessons: [Lesson] = []
    @Published var tomorrowLessons: [Lesson] = []
    @Published var outbound: Itinerary?
    @Published var departures: [Itinerary] = []
    @Published var error: String?
    @Published var loading = false
    @Published var updated: Date?
    @Published var settings = LocalSettings.load()
    private let service = FLURService()
    private let cacheKey = "flur.schedule.cache.v1"
    init() {
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let cached = try? JSONDecoder().decode(ScheduleCache.self, from: data) {
            lessons = cached.today; tomorrowLessons = cached.tomorrow; updated = cached.savedAt
        }
    }
    func refresh() async {
        guard !loading else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            let days = try await service.fetchLessons(settings)
            lessons = days.0; tomorrowLessons = days.1; updated = .now
            if let data = try? JSONEncoder().encode(ScheduleCache(today: days.0, tomorrow: days.1, savedAt: .now)) {
                UserDefaults.standard.set(data, forKey: cacheKey)
                SharedScheduleStore.save(today: days.0, tomorrow: days.1, outbound: outbound, departures: departures, savedAt: .now)
            }
        } catch { self.error = error.localizedDescription; return }
        do {
            let trips = try await service.fetchTrips(settings, today: lessons, tomorrow: tomorrowLessons)
            outbound = trips.0; departures = trips.1
            SharedScheduleStore.save(today: lessons, tomorrow: tomorrowLessons, outbound: outbound, departures: departures, savedAt: updated ?? .now)
        } catch {
            self.error = error.localizedDescription
            SharedScheduleStore.save(today: lessons, tomorrow: tomorrowLessons, outbound: outbound, departures: departures, savedAt: updated ?? .now)
        }
    }
    func save() { settings.save() }
}

struct LocalSettings {
    var server = "", school = "", user = "", whoName = "", home = "", station = "", schoolStop = "", mode = "bike", who = "student"
    var password: String { get { Keychain.read() } set { Keychain.write(newValue) } }
    static func load() -> LocalSettings {
        let d = UserDefaults.standard
        var s = LocalSettings()
        s.server = d.string(forKey:"server") ?? ""; s.school = d.string(forKey:"school") ?? ""; s.user = d.string(forKey:"user") ?? ""
        s.whoName = d.string(forKey:"whoName") ?? ""; s.home = d.string(forKey:"home") ?? ""; s.station = d.string(forKey:"station") ?? ""
        s.schoolStop = d.string(forKey:"schoolStop") ?? ""; s.mode = d.string(forKey:"mode") ?? "bike"; s.who = d.string(forKey:"who") ?? "student"
        return s
    }
    func save() {
        let d = UserDefaults.standard
        d.set(server,forKey:"server"); d.set(school,forKey:"school"); d.set(user,forKey:"user"); d.set(whoName,forKey:"whoName")
        d.set(home,forKey:"home"); d.set(station,forKey:"station"); d.set(schoolStop,forKey:"schoolStop"); d.set(mode,forKey:"mode"); d.set(who,forKey:"who")
    }
}
enum Keychain {
    static let key = "de.linopix.flur.webuntis.password"
    static func read() -> String {
        let q: [String:Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrAccount as String:key,kSecReturnData as String:true,kSecMatchLimit as String:kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return "" }
        return String(data:data,encoding:.utf8) ?? ""
    }
    static func write(_ value: String) {
        let q: [String:Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrAccount as String:key]
        SecItemDelete(q as CFDictionary)
        guard !value.isEmpty else { return }
        var item = q; item[kSecValueData as String] = Data(value.utf8); item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary,nil)
    }
}

struct UntisNamed: Decodable { let id: Int?; let name: String?; let longname: String? }

struct FLURService {
    struct RPC: Decodable { let result: JSONValue?; let error: RPCError? }
    struct RPCError: Decodable { let message: String? }
    struct SchoolSearch: Decodable { let result: SearchResult? }
    struct SearchResult: Decodable { let schools: [SchoolHit]? }
    struct SchoolHit: Decodable { let server, loginName, displayName, name, schoolName: String? }
    struct HTTPFailure: LocalizedError {
        let service: String
        let status: Int
        let detail: String
        var errorDescription: String? {
            let clean = detail.trimmingCharacters(in: .whitespacesAndNewlines)
            return clean.isEmpty ? "\(service) antwortet mit HTTP \(status)." : "\(service) (HTTP \(status)): \(String(clean.prefix(240)))"
        }
    }
    func request<T: Decodable>(_ url: URL, body: [String:Any]? = nil, cookie: String? = nil, as: T.Type) async throws -> T {
        var req = URLRequest(url:url); req.timeoutInterval = 18; req.setValue("application/json",forHTTPHeaderField:"Accept")
        if url.host?.contains("transitous") == true { req.setValue("FLUR iOS/1.0 (https://github.com/Linopix/FLUR)", forHTTPHeaderField:"User-Agent") }
        if let cookie { req.setValue("JSESSIONID=\(cookie)",forHTTPHeaderField:"Cookie") }
        if let body { req.httpMethod="POST"; req.setValue("application/json",forHTTPHeaderField:"Content-Type"); req.httpBody=try JSONSerialization.data(withJSONObject:body) }
        let (data,response) = try await URLSession.shared.data(for:req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else {
            let service = url.host?.contains("transitous") == true ? "Transitous" : "WebUntis"
            throw HTTPFailure(service: service, status: http.statusCode, detail: String(data: data, encoding: .utf8) ?? "")
        }
        return try JSONDecoder().decode(T.self,from:data)
    }
    func rpc<T: Decodable>(_ base: URL, school: String, method: String, params: [String:Any], cookie: String? = nil, as: T.Type) async throws -> T {
        var c = URLComponents(url:base.appendingPathComponent("WebUntis/jsonrpc.do"),resolvingAgainstBaseURL:false)!; c.queryItems=[URLQueryItem(name:"school",value:school)]
        let payload:[String:Any] = ["id":"flur","method":method,"params":params,"jsonrpc":"2.0"]
        let result: RPC = try await request(c.url!,body:payload,cookie:cookie,as:RPC.self)
        if let message=result.error?.message { throw NSError(domain:"WebUntis",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
        guard let value=result.result else { throw NSError(domain:"WebUntis",code:2,userInfo:[NSLocalizedDescriptionKey:"WebUntis hat keine Daten geliefert."]) }
        let data=try JSONEncoder().encode(value); return try JSONDecoder().decode(T.self,from:data)
    }
    func fetchLessons(_ s: LocalSettings) async throws -> ([Lesson],[Lesson]) {
        guard !s.server.isEmpty,!s.school.isEmpty,!s.user.isEmpty,!s.password.isEmpty else { throw NSError(domain:"FLUR",code:1,userInfo:[NSLocalizedDescriptionKey:"Ergänze deine WebUntis-Zugangsdaten in den Einstellungen."]) }
        let serverURL = s.server.contains("://") ? s.server : "https://\(s.server.contains(".") ? s.server : s.server+".webuntis.com")"
        guard let base=URL(string:serverURL),base.scheme=="https" else { throw NSError(domain:"FLUR",code:2,userInfo:[NSLocalizedDescriptionKey:"Bitte einen gültigen HTTPS-WebUntis-Server eintragen."]) }
        let typedSchool=s.school.trimmingCharacters(in:.whitespaces)
        var search = URLRequest(url: URL(string:"https://mobile.webuntis.com/ms/schoolquery2")!)
        search.httpMethod="POST"; search.setValue("application/json",forHTTPHeaderField:"Content-Type")
        search.httpBody=try JSONSerialization.data(withJSONObject:["id":"flur","method":"searchSchool","params":[["search":typedSchool]],"jsonrpc":"2.0"])
        let found: [SchoolHit]
        do {
            let (data,_) = try await URLSession.shared.data(for:search)
            found = try JSONDecoder().decode(SchoolSearch.self,from:data).result?.schools ?? []
        } catch {
            throw NSError(domain: "FLUR", code: 7, userInfo: [NSLocalizedDescriptionKey: "WebUntis-Schulsuche fehlgeschlagen: \(error.localizedDescription)"])
        }
        func normalizedHost(_ raw: String?) -> String? {
            guard let raw, !raw.isEmpty else { return nil }
            let candidate = raw.contains("://") ? raw : "https://\(raw)"
            return URLComponents(string: candidate)?.host?.lowercased()
        }
        func normalizedName(_ raw: String?) -> String? {
            raw?.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current).filter { $0.isLetter || $0.isNumber }
        }
        let host = base.host?.lowercased()
        let onHost = found.filter { normalizedHost($0.server) == host }
        let pool = onHost.isEmpty ? found : onHost
        let school: String
        if let match = pool.first(where: { normalizedName($0.loginName) == normalizedName(typedSchool) }), let loginName = match.loginName, !loginName.isEmpty {
            school = loginName
        } else if let match = pool.first(where: { [ $0.displayName, $0.name, $0.schoolName ].contains { normalizedName($0) == normalizedName(typedSchool) } }), let loginName = match.loginName, !loginName.isEmpty {
            school = loginName
        } else if let match = onHost.first, let loginName = match.loginName, !loginName.isEmpty {
            // Use the WebUntis login key for a result on the configured server even
            // when the displayed school name uses different punctuation or spelling.
            school = loginName
        } else if pool.count == 1, let loginName = pool[0].loginName, !loginName.isEmpty {
            school = loginName
        } else {
            throw NSError(domain: "FLUR", code: 6, userInfo: [NSLocalizedDescriptionKey: "WebUntis hat den Schulnamen auf diesem Server nicht eindeutig gefunden. Bitte trage in Daten das WebUntis-Schulkürzel ein."])
        }
        struct Login: Decodable { let sessionId:String?; let personType:Int?; let personId:Int? }
        let login: Login = try await rpc(base,school:school,method:"authenticate",params:["user":s.user,"password":s.password,"client":"FLUR"],as:Login.self)
        guard let token=login.sessionId else { throw NSError(domain:"FLUR",code:3,userInfo:[NSLocalizedDescriptionKey:"WebUntis-Anmeldung fehlgeschlagen. Prüfe Server, Schule und Passwort."]) }
        var element:[String:Int]
        if s.who == "student", let id=login.personId { element=["id":id,"type":login.personType ?? 5] }
        else {
            let classMode=s.who == "class"
            let rows:[UntisNamed] = try await rpc(base,school:school,method:classMode ? "getKlassen":"getTeachers",params:[:],cookie:token,as:[UntisNamed].self)
            guard let found=rows.first(where:{ ($0.name ?? "").caseInsensitiveCompare(s.whoName) == .orderedSame || ($0.longname ?? "").caseInsensitiveCompare(s.whoName) == .orderedSame }),let id=found.id else { throw NSError(domain:"FLUR",code:4,userInfo:[NSLocalizedDescriptionKey:"Klasse oder Lehrkraft nicht gefunden."]) }
            element=["id":id,"type":classMode ? 1:2]
        }
        let formatter=DateFormatter(); formatter.timeZone=TimeZone(identifier:"Europe/Berlin"); formatter.dateFormat="yyyyMMdd"
        var berlinCalendar = Calendar(identifier: .gregorian); berlinCalendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        func day(_ offset:Int) async throws -> [Lesson] {
            let date=berlinCalendar.date(byAdding:.day,value:offset,to:Date())!
            let ymd=Int(formatter.string(from:date))!
            struct Raw: Decodable { let id:Int?; let startTime:Int?; let endTime:Int?; let code:String?; let info:String?; let substText:String?; let lstext:String?; let su:[UntisNamed]?; let te:[UntisNamed]?; let ro:[UntisNamed]? }
            let opts:[String:Any] = ["options":["element":element,"startDate":ymd,"endDate":ymd,"showInfo":true,"showSubstText":true,"showLsText":true,"showStudentgroup":true,"klasseFields":["id","name","longname"],"roomFields":["id","name","longname"],"subjectFields":["id","name","longname"],"teacherFields":["id","name","longname"]]]
            let raws:[Raw] = try await rpc(base,school:school,method:"getTimetable",params:opts,cookie:token,as:[Raw].self)
            return raws.compactMap { r in
                guard let st=r.startTime,let en=r.endTime else{return nil}
                func mins(_ t:Int)->Int { (t/100)*60+t%100 }
                let status=(r.code ?? "").lowercased().contains("cancel") ? "cancelled" : ((r.substText != nil || (r.code ?? "").contains("irregular")) ? "substitution":"regular")
                return Lesson(id:String(r.id ?? st),startMin:mins(st),endMin:mins(en),subject:r.su?.first?.longname ?? r.su?.first?.name ?? "Unterricht",teacher:r.te?.first?.name ?? "",room:r.ro?.first?.name ?? "",info:[r.substText,r.lstext,r.info].compactMap{$0}.joined(separator:" · "),status:status)
            }.sorted{$0.startMin<$1.startMin}
        }
        let today = try await day(0); let tomorrow = try await day(1); return (today, tomorrow)
    }
    func departureTime(_ lessons: [Lesson]) -> Date {
        let now = Date()
        guard let last = lessons.filter({ $0.status != "cancelled" }).max(by: { $0.endMin < $1.endMin }) else { return now }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let components = calendar.dateComponents([.year, .month, .day], from: now)
        guard let midnight = calendar.date(from: components), let end = calendar.date(byAdding: .minute, value: last.endMin + 8, to: midnight) else { return now }
        return max(now, end)
    }
    func outboundDeadline(_ today: [Lesson], tomorrow: [Lesson]) -> Date {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        let now = Date()
        func first(_ day: [Lesson], offset: Int) -> Date? {
            guard let lesson = day.filter({ $0.status != "cancelled" }).min(by: { $0.startMin < $1.startMin }) else { return nil }
            let startOfDay = calendar.startOfDay(for: calendar.date(byAdding: .day, value: offset, to: now)!)
            return calendar.date(byAdding: .minute, value: lesson.startMin - 8, to: startOfDay)
        }
        if let target = first(today, offset: 0), target > now.addingTimeInterval(-10 * 60) { return target }
        return first(tomorrow, offset: 1) ?? now.addingTimeInterval(60 * 60)
    }
    func fetchTrips(_ s: LocalSettings, today: [Lesson], tomorrow: [Lesson]) async throws -> (Itinerary?, [Itinerary]) {
        guard !s.station.isEmpty,!s.schoolStop.isEmpty else { return (nil, []) }
        struct Point: Decodable { let lat:Double?; let lon:Double?; let name:String?; let type:String? }
        func lookup(_ text:String) async throws -> Point {
            var c=URLComponents(string:"https://api.transitous.org/api/v1/geocode")!; c.queryItems=[URLQueryItem(name:"text",value:text)]
            let points:[Point]=try await request(c.url!,as:[Point].self)
            guard let p=points.first(where:{$0.type == "STOP"}) ?? points.first, p.lat != nil,p.lon != nil else { throw NSError(domain:"FLUR",code:5,userInfo:[NSLocalizedDescriptionKey:"Haltestelle nicht gefunden: \(text)"]) }; return p
        }
        let (from,to)=try await(lookup(s.schoolStop),lookup(s.station))
        struct Result: Decodable { let itineraries:[Itinerary]? }
        func plan(_ origin: Point, _ destination: Point, at: Date, arriveBy: Bool) async throws -> [Itinerary] {
            var c=URLComponents(string:"https://api.transitous.org/api/v6/plan")!
            c.queryItems=[URLQueryItem(name:"fromPlace",value:"\(origin.lat!),\(origin.lon!)"),URLQueryItem(name:"toPlace",value:"\(destination.lat!),\(destination.lon!)"),URLQueryItem(name:"time",value:ISO8601DateFormatter().string(from:at)),URLQueryItem(name:"numItineraries",value:"5"),URLQueryItem(name:"transitModes",value:"TRANSIT"),URLQueryItem(name:"arriveBy",value:arriveBy ? "true":"false"),URLQueryItem(name:"timetableView",value:"false"),URLQueryItem(name:"searchWindow",value:"7200")]
            return try await request(c.url!,as:Result.self).itineraries ?? []
        }
        let outbound = try await plan(to, from, at: outboundDeadline(today, tomorrow: tomorrow), arriveBy: true)
        let homebound = try await plan(from, to, at: departureTime(today), arriveBy: false)
        let viableOutbound = outbound.filter { row in
            guard let start = row.startTime, let end = row.endTime,
                  ISO8601DateFormatter().date(from: start) != nil,
                  let date = ISO8601DateFormatter().date(from: end) else { return false }
            return date <= outboundDeadline(today, tomorrow: tomorrow).addingTimeInterval(60) && !(row.legs ?? []).contains(where: { $0.cancelled == true || $0.from?.cancelled == true || $0.to?.cancelled == true })
        }.max { epoch($0.startTime) < epoch($1.startTime) }
        let viableHomebound = homebound.filter { !($0.legs ?? []).contains(where: { $0.cancelled == true || $0.from?.cancelled == true || $0.to?.cancelled == true }) }.sorted { epoch($0.startTime) < epoch($1.startTime) }
        return (viableOutbound, viableHomebound)
    }
    func epoch(_ value: String?) -> Double { guard let value, let date = ISO8601DateFormatter().date(from: value) else { return .greatestFiniteMagnitude }; return date.timeIntervalSince1970 }
}
enum JSONValue: Codable { case string(String), number(Double), object([String:JSONValue]), array([JSONValue]), bool(Bool), null
    init(from decoder:Decoder)throws { let c=try decoder.singleValueContainer(); if c.decodeNil(){self = .null} else if let x=try? c.decode(String.self){self = .string(x)} else if let x=try? c.decode(Double.self){self = .number(x)} else if let x=try? c.decode(Bool.self){self = .bool(x)} else if let x=try? c.decode([String:JSONValue].self){self = .object(x)} else {self = .array(try c.decode([JSONValue].self))} }
    func encode(to encoder:Encoder)throws { var c=encoder.singleValueContainer(); switch self {case .string(let x):try c.encode(x);case .number(let x):try c.encode(x);case .bool(let x):try c.encode(x);case .null:try c.encodeNil();case .array(let x):try c.encode(x);case .object(let x):try c.encode(x)} }
}

private enum FlurStyle {
    static let background = Color(red: 0.067, green: 0.075, blue: 0.090)
    static let surface = Color(red: 0.102, green: 0.114, blue: 0.137)
    static let surfaceRaised = Color(red: 0.125, green: 0.137, blue: 0.161)
    static let border = Color(red: 0.192, green: 0.208, blue: 0.239)
    static let gold = Color(red: 0.855, green: 0.682, blue: 0.337)
    static let text = Color(red: 0.945, green: 0.941, blue: 0.922)
    static let muted = Color(red: 0.655, green: 0.675, blue: 0.714)
    static let red = Color(red: 0.91, green: 0.43, blue: 0.41)
}

private enum FlurTab: Hashable { case current, outbound, homebound, posts, data }

struct DashboardView: View {
    @EnvironmentObject private var model: FLURModel
    @State private var selection: FlurTab = .current

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { CurrentScreen() }.tabItem { Label("Aktuell", systemImage: "sparkle") }.tag(FlurTab.current)
            TravelScreen(direction: .outbound).tabItem { Label("Hinweg", systemImage: "tram") }.tag(FlurTab.outbound)
            TravelScreen(direction: .homebound).tabItem { Label("Heimweg", systemImage: "house") }.tag(FlurTab.homebound)
            PostsScreen().tabItem { Label("Post", systemImage: "envelope") }.tag(FlurTab.posts)
            DataScreen().tabItem { Label("Daten", systemImage: "gearshape") }.tag(FlurTab.data)
        }
        .tint(FlurStyle.gold)
        .toolbarBackground(FlurStyle.surface, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .preferredColorScheme(.dark)
        .task { await model.refresh() }
    }
}

private struct CurrentScreen: View {
    @EnvironmentObject private var model: FLURModel
    @State private var now = Date.now
    private let tick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()
    private var minute: Int { Calendar.current.component(.hour, from: now) * 60 + Calendar.current.component(.minute, from: now) }
    private var activeLesson: Lesson? { model.lessons.first { $0.startMin <= minute && minute < $0.endMin && $0.status != "cancelled" } }
    private var nextLesson: Lesson? { model.lessons.first { $0.startMin > minute && $0.status != "cancelled" } }
    private var pastLessons: Bool { !model.lessons.filter { $0.status != "cancelled" }.isEmpty && nextLesson == nil && activeLesson == nil }
    private var outboundDeparture: String? { model.outbound?.legs?.first?.from?.departure ?? model.outbound?.legs?.first?.from?.scheduledDeparture }
    private var outboundArrival: String? { model.outbound?.legs?.last?.to?.arrival ?? model.outbound?.legs?.last?.to?.scheduledArrival }
    private var homeDeparture: String? { model.departures.first?.legs?.first?.from?.departure ?? model.departures.first?.legs?.first?.from?.scheduledDeparture }
    private var targetMinute: Int? {
        if let activeLesson { return activeLesson.endMin }
        if let nextLesson {
            if let outboundDeparture, let parsed = minutes(outboundDeparture), parsed > minute { return parsed - minute <= 150 ? parsed : nextLesson.startMin }
            return nextLesson.startMin
        }
        if pastLessons, let homeDeparture, let parsed = minutes(homeDeparture), parsed > minute { return parsed }
        if let first = model.tomorrowLessons.first { return 24 * 60 + first.startMin }
        return nil
    }
    private var heading: String {
        if activeLesson != nil { return "Stunde endet in" }
        if nextLesson != nil {
            if let outboundDeparture, let parsed = minutes(outboundDeparture), parsed > minute, parsed - minute <= 150 { return "Aufbruch in" }
            return "Nächste Stunde in"
        }
        if pastLessons, targetMinute != nil { return "Abfahrt nach Hause in" }
        return "Nächster Schultag"
    }
    private func countdown(_ target: Int?) -> String {
        guard let target else { return "—" }
        let delta = max(0, target - minute)
        return delta == 0 ? "jetzt" : delta >= 60 ? "\(delta / 60) Std. \(delta % 60) Min." : "\(delta) Min."
    }

    var body: some View {
        ZStack {
            FlurStyle.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .center) {
                        FLURMark(size: 18)
                        Spacer()
                        Text(now.formatted(date: .omitted, time: .shortened)).font(.system(.title3, design: .rounded).weight(.semibold).monospacedDigit()).foregroundStyle(FlurStyle.gold)
                    }.padding(.top, 6)
                    PageHeader(eyebrow: "DEIN TAG IN BEWEGUNG", title: "Aktuell", subtitle: now.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "de_DE"))))
                    VStack(alignment: .leading, spacing: 15) {
                        SectionLabel(heading.uppercased())
                        Text(countdown(targetMinute)).font(.system(size: 40, weight: .semibold, design: .rounded).monospacedDigit()).foregroundStyle(FlurStyle.text).contentTransition(.numericText())
                        if let lesson = activeLesson {
                            Text(lesson.subject).font(.system(size: 25, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.gold)
                            Text("\(clock(lesson.startMin))–\(clock(lesson.endMin)) · \(lesson.room.isEmpty ? "Raum offen" : "Raum \(lesson.room)")")
                                .font(.subheadline).foregroundStyle(FlurStyle.muted)
                        } else if let lesson = nextLesson {
                            Text(lesson.subject).font(.system(size: 25, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.gold)
                            Text("\(clock(lesson.startMin))–\(clock(lesson.endMin)) · \(lesson.room.isEmpty ? "Raum offen" : "Raum \(lesson.room)")")
                                .font(.subheadline).foregroundStyle(FlurStyle.muted)
                        } else if pastLessons {
                            Text("Unterricht geschafft").font(.system(size: 25, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.gold)
                            Text("Zeit für den Heimweg.").font(.subheadline).foregroundStyle(FlurStyle.muted)
                        } else if let lesson = model.tomorrowLessons.first {
                            Text(lesson.subject).font(.system(size: 25, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.gold)
                            Text("Morgen um \(clock(lesson.startMin))").font(.subheadline).foregroundStyle(FlurStyle.muted)
                        } else {
                            Text(model.loading ? "Stundenplan wird geladen …" : "Verbinde WebUntis für deinen nächsten Termin.").font(.subheadline).foregroundStyle(FlurStyle.muted)
                        }
                    }
                    .padding(22).frame(maxWidth: .infinity, alignment: .leading)
                    .background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 22))
                    .overlay(RoundedRectangle(cornerRadius: 22).stroke(FlurStyle.border, lineWidth: 1))
                    if activeLesson == nil && (nextLesson != nil || pastLessons) {
                        VStack(alignment: .leading, spacing: 14) {
                            SectionLabel(pastLessons ? "HEIMWEG" : "WEG ZUR SCHULE")
                            if pastLessons, let trip = model.departures.first { ItineraryCard(item: trip) }
                            else if let trip = model.outbound { ItineraryCard(item: trip) }
                            else { Text("Verbindung wird geladen. Hinterlege Haltestellen unter Daten.").font(.subheadline).foregroundStyle(FlurStyle.muted) }
                            if let departure = pastLessons ? homeDeparture : outboundDeparture {
                                HStack { Label("Abfahrt", systemImage: "tram.fill"); Spacer(); Text(departure).monospacedDigit() }
                                    .font(.subheadline.weight(.medium)).foregroundStyle(FlurStyle.text)
                            }
                            if !pastLessons, let arrival = outboundArrival {
                                HStack { Label("Ankunft", systemImage: "mappin.and.ellipse"); Spacer(); Text(arrival).monospacedDigit() }
                                    .font(.subheadline.weight(.medium)).foregroundStyle(FlurStyle.text)
                            }
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(FlurStyle.border, lineWidth: 1))
                    }
                    HStack(spacing: 8) { Image(systemName: "clock"); Text("Uhrzeit \(now.formatted(date: .omitted, time: .shortened)) · lokal berechnet") }
                        .font(.caption).foregroundStyle(FlurStyle.muted)
                    NavigationLink(destination: TodayScreen()) {
                        HStack { Label("Stundenplan und Änderungen", systemImage: "calendar"); Spacer(); Image(systemName: "chevron.right") }
                            .font(.subheadline.weight(.medium)).foregroundStyle(FlurStyle.text)
                            .padding(17).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 16))
                    }.buttonStyle(.plain)
                }.padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 24)
            }.refreshable { await model.refresh() }
        }.onReceive(tick) { now = $0 }
    }
}

private struct FLURMark: View {
    var size: CGFloat = 16
    var body: some View {
        VStack(spacing: 0) {
            Text("FL"); Text("UR")
        }.font(.system(size: size, weight: .black, design: .rounded).monospaced())
            .tracking(-size * 0.05).lineSpacing(-size * 0.24).foregroundStyle(FlurStyle.gold)
            .frame(width: size * 2.2, height: size * 2.1)
    }
}

private struct TodayScreen: View {
    @EnvironmentObject private var model: FLURModel
    private var todayLabel: String {
        Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "de_DE")))
    }
    private var nextLesson: Lesson? {
        let now = Calendar.current.dateComponents([.hour, .minute], from: .now)
        let minute = (now.hour ?? 0) * 60 + (now.minute ?? 0)
        return model.lessons.first { $0.endMin > minute && $0.status != "cancelled" }
    }
    private var changes: [Lesson] {
        model.lessons.filter { $0.status != "regular" || !$0.info.isEmpty }
    }

    var body: some View {
        ZStack {
            FlurStyle.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    PageHeader(eyebrow: "FLUR", title: "Heute", subtitle: todayLabel)

                    if let error = model.error { ErrorBanner(message: error) }

                    VStack(alignment: .leading, spacing: 15) {
                        SectionLabel("ALS NÄCHSTES")
                        if let lesson = nextLesson {
                            Text(lesson.subject).font(.system(size: 31, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
                            Text("\(clock(lesson.startMin))–\(clock(lesson.endMin))")
                                .font(.system(size: 17, weight: .medium, design: .rounded)).foregroundStyle(FlurStyle.text)
                            Text([lesson.room.isEmpty ? nil : "Raum \(lesson.room)", lesson.teacher.isEmpty ? nil : lesson.teacher].compactMap { $0 }.joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(FlurStyle.muted)
                        } else {
                            Text(model.loading ? "Stundenplan wird geladen …" : (model.lessons.isEmpty ? "Verbinde WebUntis, um deinen Tag zu sehen." : "Für heute ist kein weiterer Unterricht geplant."))
                                .font(.body).foregroundStyle(FlurStyle.muted)
                        }
                    }
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading)
                    .background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 19))
                    .overlay(RoundedRectangle(cornerRadius: 19).stroke(FlurStyle.border, lineWidth: 1))

                    VStack(alignment: .leading, spacing: 0) {
                        SectionLabel("STUNDEN").padding(.bottom, 8)
                        if model.lessons.isEmpty {
                            EmptyState(icon: "calendar", title: "Noch kein Stundenplan", detail: "Hinterlege deine WebUntis-Daten im Bereich Daten.")
                        } else {
                            ForEach(model.lessons.indices, id: \.self) { index in
                                let lesson = model.lessons[index]
                                if index > 0, let previous = model.lessons[safe: index - 1], lesson.startMin - previous.endMin >= 10 {
                                    Text("Pause  ·  \(lesson.startMin - previous.endMin) Min")
                                        .font(.caption).foregroundStyle(FlurStyle.muted).padding(.leading, 9).padding(.vertical, 12)
                                }
                                LessonRow(lesson: lesson)
                            }
                        }
                    }.padding(18).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(FlurStyle.border, lineWidth: 1))

                    if !changes.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionLabel("ÄNDERUNGEN")
                            ForEach(changes) { lesson in
                                HStack(alignment: .top, spacing: 10) {
                                    Circle().fill(lesson.status == "cancelled" ? FlurStyle.red : FlurStyle.gold).frame(width: 7, height: 7).padding(.top, 6)
                                    Text(changeSummary(lesson)).font(.subheadline).foregroundStyle(FlurStyle.text)
                                }
                            }
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(FlurStyle.border, lineWidth: 1))
                    }

                    if !model.tomorrowLessons.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionLabel("MORGEN")
                            ForEach(model.tomorrowLessons.prefix(3)) { lesson in
                                HStack(spacing: 14) { Text(clock(lesson.startMin)).font(.system(.subheadline, design: .rounded).weight(.semibold)).foregroundStyle(FlurStyle.gold); Text(lesson.subject).font(.subheadline.weight(.medium)).foregroundStyle(FlurStyle.text) }
                            }
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 19)).overlay(RoundedRectangle(cornerRadius: 19).stroke(FlurStyle.border, lineWidth: 1))
                    }
                }.padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 24)
            }.refreshable { await model.refresh() }
        }
    }
}

private struct TravelScreen: View {
    enum Direction: Equatable { case outbound, homebound }
    @EnvironmentObject private var model: FLURModel
    let direction: Direction
    private var isOutbound: Bool { direction == .outbound }
    private var trips: [Itinerary] { isOutbound ? model.outbound.map { [$0] } ?? [] : model.departures }

    var body: some View {
        ZStack {
            FlurStyle.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PageHeader(eyebrow: "FLUR  ·  MOBILITÄT", title: isOutbound ? "Hinweg" : "Heimweg", subtitle: isOutbound ? "Pünktlich zur Schule" : "Nach dem Unterricht nach Hause")
                    if let error = model.error { ErrorBanner(message: error) }
                    if trips.isEmpty {
                        EmptyStateCard(icon: "tram", title: isOutbound ? "Dein Weg zur Schule" : "Dein Weg nach Hause", detail: "Trag Bahnhof und Haltestellen im Bereich Daten ein. FLUR sucht passende Verbindungen direkt für dich.")
                    } else {
                        SectionLabel(isOutbound ? "PASSENDE VERBINDUNG" : "ABFAHRTEN")
                        ForEach(trips) { trip in ItineraryCard(item: trip) }
                    }
                    Label("Fahrplandaten werden direkt und ohne FLUR-Server abgerufen.", systemImage: "lock.shield")
                        .font(.caption).foregroundStyle(FlurStyle.muted).padding(.top, 6)
                }.padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 24)
            }.refreshable { await model.refresh() }
        }
    }
}

private struct PostsScreen: View {
    @EnvironmentObject private var model: FLURModel
    private var changes: [Lesson] { model.lessons.filter { $0.status != "regular" || !$0.info.isEmpty } }
    var body: some View {
        ZStack {
            FlurStyle.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PageHeader(eyebrow: "FLUR  ·  MITTEILUNGEN", title: "Post", subtitle: "Was sich heute ändert")
                    if changes.isEmpty {
                        EmptyStateCard(icon: "envelope", title: "Alles ruhig", detail: "Vertretungen und Ausfälle erscheinen hier, sobald dein Stundenplan geladen ist.")
                    } else {
                        ForEach(changes) { lesson in
                            VStack(alignment: .leading, spacing: 10) {
                                SectionLabel(lesson.status == "cancelled" ? "ENTFÄLLT" : "VERTRETUNG")
                                Text(lesson.subject).font(.system(size: 24, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
                                Text("\(clock(lesson.startMin))–\(clock(lesson.endMin))  ·  \(lesson.room.isEmpty ? "Raum offen" : lesson.room)").font(.subheadline).foregroundStyle(FlurStyle.muted)
                                if !lesson.info.isEmpty { Text(lesson.info).font(.subheadline).foregroundStyle(FlurStyle.gold) }
                                if !lesson.teacher.isEmpty { Text(lesson.teacher).font(.caption).foregroundStyle(FlurStyle.muted) }
                            }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(FlurStyle.border, lineWidth: 1))
                        }
                    }
                }.padding(.horizontal, 18).padding(.top, 14)
            }
        }
    }
}

private struct DataScreen: View {
    @EnvironmentObject private var model: FLURModel
    @State private var password = ""
    @State private var saved = false

    var body: some View {
        ZStack {
            FlurStyle.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PageHeader(eyebrow: "FLUR  ·  PRIVAT", title: "Daten", subtitle: "Deine Verbindung und dein Weg")
                    VStack(alignment: .leading, spacing: 16) {
                        SectionLabel("WEBUNTIS")
                        input("Server", placeholder: "z. B. mese.webuntis.com", keyPath: \.server, capitalization: .never)
                        input("Schule", placeholder: "Schulname oder Kennung", keyPath: \.school)
                        input("Benutzername", placeholder: "WebUntis-Benutzername", keyPath: \.user, capitalization: .never)
                        VStack(alignment: .leading, spacing: 7) { Text("PASSWORT").font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1.4).foregroundStyle(FlurStyle.muted); SecureField("WebUntis-Passwort", text: $password).textContentType(.password).foregroundStyle(FlurStyle.text).padding(14).background(FlurStyle.background, in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(FlurStyle.border, lineWidth: 1)) }
                        VStack(alignment: .leading, spacing: 7) {
                            Text("ANMELDEN ALS").font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1.4).foregroundStyle(FlurStyle.muted)
                            Picker("Anmelden als", selection: bind(\.who)) { Text("Schüler/in").tag("student"); Text("Klasse").tag("class"); Text("Lehrkraft").tag("teacher") }.pickerStyle(.segmented).tint(FlurStyle.gold)
                        }
                        if model.settings.who != "student" { input("Klasse oder Kürzel", placeholder: "z. B. 5A", keyPath: \.whoName) }
                    }.padding(18).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(FlurStyle.border, lineWidth: 1))

                    VStack(alignment: .leading, spacing: 16) {
                        SectionLabel("DEIN WEG")
                        input("Zuhause", placeholder: "Ort oder Adresse", keyPath: \.home)
                        input("Bahnhof", placeholder: "Bahnhof für die Heimfahrt", keyPath: \.station)
                        input("Haltestelle an der Schule", placeholder: "Nächster Halt", keyPath: \.schoolStop)
                        VStack(alignment: .leading, spacing: 7) {
                            Text("VERKEHRSMITTEL").font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1.4).foregroundStyle(FlurStyle.muted)
                            Picker("Verkehrsmittel", selection: bind(\.mode)) { Text("Fahrrad").tag("bike"); Text("Zu Fuß").tag("walk"); Text("Auto").tag("car"); Text("Bus").tag("bus") }.tint(FlurStyle.gold)
                        }
                    }.padding(18).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(FlurStyle.border, lineWidth: 1))

                    Button {
                        model.settings.password = password
                        model.save()
                        saved = true
                        Task { await model.refresh() }
                    } label: {
                        HStack { Image(systemName: saved ? "checkmark" : "arrow.down.to.line"); Text(saved ? "Gespeichert" : "Daten sichern") }
                            .font(.headline).foregroundStyle(FlurStyle.background).frame(maxWidth: .infinity).padding(.vertical, 16).background(FlurStyle.gold, in: RoundedRectangle(cornerRadius: 14))
                    }

                    VStack(alignment: .leading, spacing: 9) {
                        Label("Privat auf diesem iPhone", systemImage: "lock.shield.fill").font(.subheadline.weight(.semibold)).foregroundStyle(FlurStyle.text)
                        Text("Deine Zugangsdaten bleiben auf deinem Gerät. FLUR verbindet sich direkt mit WebUntis und öffentlichen Fahrplandiensten – ohne eigenen Server.")
                            .font(.caption).foregroundStyle(FlurStyle.muted).fixedSize(horizontal: false, vertical: true)
                        if let updated = model.updated { Text("Zuletzt aktualisiert · \(updated.formatted(date: .abbreviated, time: .shortened))").font(.caption2).foregroundStyle(FlurStyle.muted) }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 16))
                }.padding(.horizontal, 18).padding(.top, 14).padding(.bottom, 30)
            }
        }
        .onAppear { password = model.settings.password }
    }

    private func input(_ title: String, placeholder: String, keyPath: WritableKeyPath<LocalSettings, String>, capitalization: TextInputAutocapitalization = .words) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title.uppercased()).font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1.4).foregroundStyle(FlurStyle.muted)
            TextField(placeholder, text: bind(keyPath)).textInputAutocapitalization(capitalization).autocorrectionDisabled().foregroundStyle(FlurStyle.text).padding(14).background(FlurStyle.background, in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(FlurStyle.border, lineWidth: 1))
        }
    }

    private func bind<T>(_ keyPath: WritableKeyPath<LocalSettings, T>) -> Binding<T> {
        Binding(get: { model.settings[keyPath: keyPath] }, set: { model.settings[keyPath: keyPath] = $0; saved = false })
    }
}

private struct PageHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow.uppercased()).font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1.8).foregroundStyle(FlurStyle.gold)
                Text(title).font(.system(size: 36, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
                Text(subtitle).font(.subheadline).foregroundStyle(FlurStyle.muted)
            }
            Spacer(minLength: 4)
            Text(Date.now.formatted(.dateTime.hour().minute())).font(.system(size: 14, weight: .semibold, design: .rounded).monospacedDigit()).foregroundStyle(FlurStyle.gold).padding(.top, 5)
        }.padding(.bottom, 2)
    }
}

private struct SectionLabel: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View { Text(title).font(.system(size: 11, weight: .bold, design: .rounded)).tracking(1.5).foregroundStyle(FlurStyle.muted) }
}

private struct LessonRow: View {
    let lesson: Lesson
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(clock(lesson.startMin)).font(.system(size: 16, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
                Text(clock(lesson.endMin)).font(.system(size: 12, weight: .regular, design: .serif)).foregroundStyle(FlurStyle.muted)
            }.frame(width: 52, alignment: .leading)
            RoundedRectangle(cornerRadius: 2).fill(lesson.status == "cancelled" ? FlurStyle.red : FlurStyle.gold.opacity(0.8)).frame(width: 2, height: 38)
            VStack(alignment: .leading, spacing: 4) {
                Text(lesson.subject).font(.system(size: 16, weight: .semibold, design: .rounded)).foregroundStyle(lesson.status == "cancelled" ? FlurStyle.muted : FlurStyle.text).strikethrough(lesson.status == "cancelled")
                Text([lesson.teacher, lesson.info].filter { !$0.isEmpty }.joined(separator: "  ·  ")).font(.system(size: 12, weight: .regular, design: .rounded)).foregroundStyle(lesson.info.isEmpty ? FlurStyle.muted : FlurStyle.gold)
            }
            Spacer(minLength: 4)
            if !lesson.room.isEmpty { Text(lesson.room).font(.system(size: 12, weight: .medium, design: .rounded)).foregroundStyle(FlurStyle.muted).lineLimit(1) }
        }.padding(.vertical, 13)
        .overlay(alignment: .bottom) { FlurStyle.border.opacity(0.65).frame(height: 0.5).padding(.leading, 66) }
    }
}

private struct ItineraryCard: View {
    let item: Itinerary
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(time(item.startTime)).font(.system(size: 22, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
                Image(systemName: "arrow.right").font(.caption.weight(.bold)).foregroundStyle(FlurStyle.gold)
                Text(time(item.endTime)).font(.system(size: 22, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
                Spacer()
                Text("LIVE").font(.system(size: 10, weight: .bold, design: .rounded)).tracking(1).foregroundStyle(FlurStyle.gold)
            }
            ForEach(item.legs ?? []) { leg in
                HStack(spacing: 8) {
                    Image(systemName: leg.mode == "WALK" ? "figure.walk" : "tram.fill").foregroundStyle(FlurStyle.gold).frame(width: 18)
                    Text(leg.routeShortName ?? leg.displayName ?? (leg.mode == "WALK" ? "Zu Fuß" : "Zug")).font(.caption.weight(.semibold)).foregroundStyle(FlurStyle.text)
                    Text(leg.from?.name ?? "").font(.caption).foregroundStyle(FlurStyle.muted).lineLimit(1)
                    Image(systemName: "arrow.right").font(.system(size: 9)).foregroundStyle(FlurStyle.muted)
                    Text(leg.to?.name ?? "").font(.caption).foregroundStyle(FlurStyle.muted).lineLimit(1)
                    Spacer(minLength: 2)
                    Text(time(leg.from?.departure)).font(.caption.monospacedDigit()).foregroundStyle(FlurStyle.text)
                }
            }
        }.padding(17).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 17)).overlay(RoundedRectangle(cornerRadius: 17).stroke(FlurStyle.border, lineWidth: 1))
    }
}

private struct EmptyState: View {
    let icon: String
    let title: String
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon).font(.subheadline.weight(.semibold)).foregroundStyle(FlurStyle.text)
            Text(detail).font(.caption).foregroundStyle(FlurStyle.muted).fixedSize(horizontal: false, vertical: true)
        }.padding(.vertical, 14).frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct EmptyStateCard: View {
    let icon: String
    let title: String
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: icon).font(.system(size: 20, weight: .medium)).foregroundStyle(FlurStyle.gold).padding(12).background(FlurStyle.gold.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
            Text(title).font(.system(size: 24, weight: .semibold, design: .serif)).foregroundStyle(FlurStyle.text)
            Text(detail).font(.subheadline).foregroundStyle(FlurStyle.muted).fixedSize(horizontal: false, vertical: true)
        }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(FlurStyle.surface, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(FlurStyle.border, lineWidth: 1))
    }
}

private struct ErrorBanner: View {
    let message: String
    var body: some View {
        Label(message, systemImage: "wifi.exclamationmark")
            .font(.caption).foregroundStyle(FlurStyle.red).padding(13).frame(maxWidth: .infinity, alignment: .leading)
            .background(FlurStyle.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }
}

private func clock(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }
private func minutes(_ value: String) -> Int? {
    let pieces = value.split(separator: ":")
    guard pieces.count >= 2, let hour = Int(pieces[0]), let minute = Int(pieces[1]) else { return nil }
    return hour * 60 + minute
}
private func time(_ string: String?) -> String {
    guard let string, let date = ISO8601DateFormatter().date(from: string) else { return "–" }
    return date.formatted(date: .omitted, time: .shortened)
}
private func changeSummary(_ lesson: Lesson) -> String {
    let status = lesson.status == "cancelled" ? "Entfällt" : "Vertretung"
    return "\(status)  ·  \(lesson.subject) \(clock(lesson.startMin))–\(clock(lesson.endMin))  ·  \(lesson.room)\(lesson.info.isEmpty ? "" : "  ·  \(lesson.info)")"
}
private extension Collection {
    subscript(safe index: Index) -> Element? { indices.contains(index) ? self[index] : nil }
}
