import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

type Sport = "Fotball" | "Handball";
type Tab = "home" | "matches" | "inbox" | "mine";
type MatchStatus = "ledig" | "avtalt";
type RequestStatus = "venter" | "godkjent" | "avslatt";

type TeamProfile = {
  id: string;
  sport: Sport;
  club: string;
  team: string;
  ageGroup: string;
  level: string;
  contactName: string;
  phone: string;
  email: string;
};

type Match = {
  id: string;
  title: string;
  sport: Sport;
  hostTeamId: string;
  hostClub: string;
  hostTeam: string;
  ageGroup: string;
  level: string;
  date: string;
  time: string;
  place: string;
  city: string;
  matchType: string;
  comment: string;
  contactName: string;
  status: MatchStatus;
  approvedRequestId?: string;
};

type MatchRequest = {
  id: string;
  matchId: string;
  fromTeamId: string;
  fromClub: string;
  fromTeam: string;
  message: string;
  status: RequestStatus;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  requestId: string;
  sender: string;
  text: string;
  createdAt: string;
};

const colors = {
  background: "#F8FBF7",
  card: "#FFFFFF",
  cardSoft: "#EFF8EF",
  border: "#D7E4D7",
  text: "#172016",
  muted: "#657165",
  green: "#2EAA4F",
  greenDark: "#126B31",
  greenLight: "#BFEBC8",
  red: "#D94B48",
  redSoft: "#FFE8E7",
  black: "#101510"
};

const currentProfile: TeamProfile = {
  id: "team-current",
  sport: "Fotball",
  club: "FC Oslo",
  team: "G13",
  ageGroup: "G13",
  level: "Niva 2",
  contactName: "Tommy Hansen",
  phone: "900 00 000",
  email: "tommy@fcoslo.no"
};

const opponentProfile: TeamProfile = {
  id: "team-opponent",
  sport: "Fotball",
  club: "Bisset Stadion FK",
  team: "G13",
  ageGroup: "G13",
  level: "Niva 2",
  contactName: "Line Berg",
  phone: "911 11 111",
  email: "line@bisset.no"
};

const initialMatches: Match[] = [
  {
    id: "match-1",
    title: "Test 1 - Treningskamp",
    sport: "Fotball",
    hostTeamId: opponentProfile.id,
    hostClub: opponentProfile.club,
    hostTeam: opponentProfile.team,
    ageGroup: "G13",
    level: "Niva 2",
    date: "15.06.2026",
    time: "18:00",
    place: "Bisset Stadion",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Vi onsker jevn motstand. Kan spille 3 x 25 minutter.",
    contactName: opponentProfile.contactName,
    status: "ledig"
  },
  {
    id: "match-2",
    title: "Soker kamp G13",
    sport: "Fotball",
    hostTeamId: "team-lyn",
    hostClub: "Lyn",
    hostTeam: "G13",
    ageGroup: "G13",
    level: "Niva 1",
    date: "20.06.2026",
    time: "12:00",
    place: "Kringsja kunstgress",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Helst bortekamp, men kan stille bane ved behov.",
    contactName: "Marius Lie",
    status: "avtalt",
    approvedRequestId: "request-approved-demo"
  },
  {
    id: "match-3",
    title: "J12 handballkamp",
    sport: "Handball",
    hostTeamId: "team-handball",
    hostClub: "Nordstrand",
    hostTeam: "J12",
    ageGroup: "J12",
    level: "Niva 2",
    date: "22.06.2026",
    time: "17:30",
    place: "Nordstrandhallen",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Vi tester handball som idrettsvalg i appen.",
    contactName: "Siv Johansen",
    status: "ledig"
  }
];

const initialRequests: MatchRequest[] = [
  {
    id: "request-1",
    matchId: "match-1",
    fromTeamId: currentProfile.id,
    fromClub: currentProfile.club,
    fromTeam: currentProfile.team,
    message: "Vi spiller gjerne denne kampen. Niva og dato passer bra.",
    status: "venter",
    createdAt: "I dag"
  }
];

const initialMessages: ChatMessage[] = [
  {
    id: "msg-1",
    requestId: "request-1",
    sender: currentProfile.contactName,
    text: "Hei, vi er interessert i kampen deres.",
    createdAt: "10:04"
  }
];

const emptyForm = {
  sport: currentProfile.sport,
  title: "",
  ageGroup: currentProfile.ageGroup,
  level: currentProfile.level,
  date: "",
  time: "",
  place: "",
  city: "",
  matchType: "Treningskamp",
  comment: ""
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [requests, setRequests] = useState<MatchRequest[]>(initialRequests);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [form, setForm] = useState(emptyForm);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;

  const myHostedMatches = useMemo(
    () => matches.filter((match) => match.hostTeamId === currentProfile.id),
    [matches]
  );

  const myRequests = useMemo(
    () => requests.filter((request) => request.fromTeamId === currentProfile.id),
    [requests]
  );

  const incomingRequests = useMemo(() => {
    const hostedIds = new Set(myHostedMatches.map((match) => match.id));
    return requests.filter((request) => hostedIds.has(request.matchId));
  }, [myHostedMatches, requests]);

  const createMatch = () => {
    if (!form.title || !form.date || !form.place || !form.city) {
      Alert.alert("Mangler informasjon", "Fyll inn tittel, dato, sted og by for kampen.");
      return;
    }

    const newMatch: Match = {
      id: `match-${Date.now()}`,
      title: form.title,
      sport: form.sport,
      hostTeamId: currentProfile.id,
      hostClub: currentProfile.club,
      hostTeam: currentProfile.team,
      ageGroup: form.ageGroup,
      level: form.level,
      date: form.date,
      time: form.time || "Ikke satt",
      place: form.place,
      city: form.city,
      matchType: form.matchType,
      comment: form.comment,
      contactName: currentProfile.contactName,
      status: "ledig"
    };

    setMatches((current) => [newMatch, ...current]);
    setForm(emptyForm);
    setCreateVisible(false);
    setActiveTab("mine");
  };

  const sendRequest = (match: Match) => {
    if (match.hostTeamId === currentProfile.id) {
      Alert.alert("Dette er din kamp", "Du kan ikke sende foresporsel pa en kamp du selv har lagt ut.");
      return;
    }

    if (match.status === "avtalt") {
      Alert.alert("Kampen er avtalt", "Denne kampen har allerede fatt motstander.");
      return;
    }

    const existing = requests.find(
      (request) => request.matchId === match.id && request.fromTeamId === currentProfile.id
    );

    if (existing && existing.status !== "avslatt") {
      Alert.alert("Foresporsel finnes", "Du har allerede sendt foresporsel pa denne kampen.");
      return;
    }

    const request: MatchRequest = {
      id: `request-${Date.now()}`,
      matchId: match.id,
      fromTeamId: currentProfile.id,
      fromClub: currentProfile.club,
      fromTeam: currentProfile.team,
      message: `${currentProfile.club} ${currentProfile.team} vil gjerne spille denne kampen.`,
      status: "venter",
      createdAt: "Na"
    };

    setRequests((current) => [request, ...current]);
    setSelectedMatchId(null);
    setActiveTab("mine");
  };

  const approveRequest = (request: MatchRequest) => {
    setRequests((current) =>
      current.map((item) => {
        if (item.id === request.id) {
          return { ...item, status: "godkjent" };
        }
        if (item.matchId === request.matchId && item.status === "venter") {
          return { ...item, status: "avslatt" };
        }
        return item;
      })
    );

    setMatches((current) =>
      current.map((match) =>
        match.id === request.matchId
          ? { ...match, status: "avtalt", approvedRequestId: request.id }
          : match
      )
    );
  };

  const declineRequest = (request: MatchRequest) => {
    setRequests((current) =>
      current.map((item) => (item.id === request.id ? { ...item, status: "avslatt" } : item))
    );

    setMatches((current) =>
      current.map((match) => {
        if (match.id !== request.matchId || match.approvedRequestId !== request.id) {
          return match;
        }
        return { ...match, status: "ledig", approvedRequestId: undefined };
      })
    );
  };

  const sendChatMessage = () => {
    if (!selectedRequest || !messageText.trim()) {
      return;
    }

    const chatMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      requestId: selectedRequest.id,
      sender: currentProfile.contactName,
      text: messageText.trim(),
      createdAt: "Na"
    };

    setMessages((current) => [...current, chatMessage]);
    setMessageText("");
  };

  const renderContent = () => {
    if (activeTab === "home") {
      return (
        <HomeScreen
          onFindMatches={() => setActiveTab("matches")}
          onCreateMatch={() => setCreateVisible(true)}
        />
      );
    }

    if (activeTab === "matches") {
      return (
        <MatchesScreen
          matches={matches}
          requests={requests}
          onOpenMatch={(id) => setSelectedMatchId(id)}
          onCreateMatch={() => setCreateVisible(true)}
        />
      );
    }

    if (activeTab === "inbox") {
      return (
        <InboxScreen
          requests={incomingRequests}
          matches={matches}
          onOpenRequest={(id) => setSelectedRequestId(id)}
        />
      );
    }

    return (
      <MineScreen
        hostedMatches={myHostedMatches}
        myRequests={myRequests}
        matches={matches}
        onOpenMatch={(id) => setSelectedMatchId(id)}
        onOpenRequest={(id) => setSelectedRequestId(id)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <Header title={getTabTitle(activeTab)} />
        <View style={styles.content}>{renderContent()}</View>
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </View>

      <CreateMatchModal
        visible={createVisible}
        form={form}
        onChange={setForm}
        onClose={() => setCreateVisible(false)}
        onSubmit={createMatch}
      />

      <MatchDetailsModal
        match={selectedMatch}
        requests={requests}
        onClose={() => setSelectedMatchId(null)}
        onSendRequest={sendRequest}
      />

      <RequestDetailsModal
        request={selectedRequest}
        match={selectedRequest ? matches.find((item) => item.id === selectedRequest.matchId) ?? null : null}
        messages={selectedRequest ? messages.filter((message) => message.requestId === selectedRequest.id) : []}
        messageText={messageText}
        onMessageTextChange={setMessageText}
        onSendChatMessage={sendChatMessage}
        onApprove={() => selectedRequest && approveRequest(selectedRequest)}
        onDecline={() => selectedRequest && declineRequest(selectedRequest)}
        onClose={() => setSelectedRequestId(null)}
      />
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

function HomeScreen({
  onFindMatches,
  onCreateMatch
}: {
  onFindMatches: () => void;
  onCreateMatch: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.home}>
      <Text style={styles.logo}>Playr</Text>
      <Text style={styles.heroTitle}>En enklere hverdag for trenere.</Text>
      <Text style={styles.heroText}>
        Finn og avtal treningskamper raskt og enkelt. Trykk Finn kamper for a se ledige
        motstandere, eller Legg ut kamp for a finne motstander.
      </Text>

      <View style={styles.homeActions}>
        <Pressable style={styles.primaryButton} onPress={onFindMatches}>
          <Ionicons name="search" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Finn kamper</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCreateMatch}>
          <Ionicons name="add-circle-outline" size={20} color={colors.greenDark} />
          <Text style={styles.secondaryButtonText}>Legg ut kamp</Text>
        </Pressable>
      </View>

      <View style={styles.profileBox}>
        <Text style={styles.sectionLabel}>Innlogget trener</Text>
        <Text style={styles.profileName}>{currentProfile.contactName}</Text>
        <Text style={styles.profileText}>
          {currentProfile.club} {currentProfile.team} · {currentProfile.sport} · {currentProfile.level}
        </Text>
      </View>
    </ScrollView>
  );
}

function MatchesScreen({
  matches,
  requests,
  onOpenMatch,
  onCreateMatch
}: {
  matches: Match[];
  requests: MatchRequest[];
  onOpenMatch: (id: string) => void;
  onCreateMatch: () => void;
}) {
  const [sportFilter, setSportFilter] = useState<Sport | "Alle">("Alle");
  const filtered = sportFilter === "Alle" ? matches : matches.filter((match) => match.sport === sportFilter);

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.filterPill}>
          <Picker
            selectedValue={sportFilter}
            onValueChange={setSportFilter}
            style={styles.compactPicker}
          >
            <Picker.Item label="Alle idretter" value="Alle" />
            <Picker.Item label="Fotball" value="Fotball" />
            <Picker.Item label="Handball" value="Handball" />
          </Picker>
        </View>
        <Pressable style={styles.iconButton} onPress={onCreateMatch}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const hasMyRequest = requests.some(
            (request) => request.matchId === item.id && request.fromTeamId === currentProfile.id
          );
          return (
            <MatchCard
              match={item}
              hasMyRequest={hasMyRequest}
              onPress={() => onOpenMatch(item.id)}
            />
          );
        }}
      />
    </View>
  );
}

function InboxScreen({
  requests,
  matches,
  onOpenRequest
}: {
  requests: MatchRequest[];
  matches: Match[];
  onOpenRequest: (id: string) => void;
}) {
  return (
    <FlatList
      data={requests}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState text="Ingen foresporsler enda." />}
      renderItem={({ item }) => {
        const match = matches.find((candidate) => candidate.id === item.matchId);
        return (
          <Pressable style={styles.requestCard} onPress={() => onOpenRequest(item.id)}>
            <View>
              <Text style={styles.cardTitle}>{item.fromClub} {item.fromTeam}</Text>
              <Text style={styles.cardMeta}>{match?.title ?? "Kamp"} · {item.createdAt}</Text>
            </View>
            <RequestBadge status={item.status} />
          </Pressable>
        );
      }}
    />
  );
}

function MineScreen({
  hostedMatches,
  myRequests,
  matches,
  onOpenMatch,
  onOpenRequest
}: {
  hostedMatches: Match[];
  myRequests: MatchRequest[];
  matches: Match[];
  onOpenMatch: (id: string) => void;
  onOpenRequest: (id: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.sectionTitle}>Mine opprettede kamper</Text>
      {hostedMatches.length === 0 ? <EmptyState text="Du har ikke lagt ut kamper enda." /> : null}
      {hostedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          hasMyRequest={false}
          onPress={() => onOpenMatch(match.id)}
        />
      ))}

      <Text style={styles.sectionTitle}>Mine foresporsler</Text>
      {myRequests.length === 0 ? <EmptyState text="Du har ikke sendt foresporsler enda." /> : null}
      {myRequests.map((request) => {
        const match = matches.find((candidate) => candidate.id === request.matchId);
        if (!match) {
          return null;
        }
        return (
          <Pressable key={request.id} style={styles.requestCard} onPress={() => onOpenRequest(request.id)}>
            <View style={styles.requestInfo}>
              <Text style={styles.cardTitle}>{match.title}</Text>
              <Text style={styles.cardMeta}>{match.hostClub} {match.hostTeam} · {match.date}</Text>
            </View>
            <RequestBadge status={request.status} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MatchCard({
  match,
  hasMyRequest,
  onPress
}: {
  match: Match;
  hasMyRequest: boolean;
  onPress: () => void;
}) {
  const statusStyle = getMatchStatusStyle(match.status);

  return (
    <Pressable style={[styles.matchCard, { borderColor: statusStyle.border }]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{match.hostClub} {match.hostTeam}</Text>
          <Text style={styles.cardMeta}>{match.sport} · {match.ageGroup} · {match.level}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{match.status}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <InfoLine icon="calendar-outline" text={`${match.date} ${match.time}`} />
        <InfoLine icon="location-outline" text={`${match.place}, ${match.city}`} />
      </View>

      {hasMyRequest ? <Text style={styles.requestHint}>Du har sendt foresporsel</Text> : null}
    </Pressable>
  );
}

function CreateMatchModal({
  visible,
  form,
  onChange,
  onClose,
  onSubmit
}: {
  visible: boolean;
  form: typeof emptyForm;
  onChange: (form: typeof emptyForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboard}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Legg ut kamp</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <ReadonlyField label="Lag" value={`${currentProfile.club} ${currentProfile.team}`} />
            <ReadonlyField label="Klubb" value={currentProfile.club} />
            <ReadonlyField label="Kontaktperson" value={currentProfile.contactName} />

            <Text style={styles.inputLabel}>Idrett</Text>
            <View style={styles.pickerField}>
              <Picker
                selectedValue={form.sport}
                onValueChange={(sport: Sport) => onChange({ ...form, sport })}
              >
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Handball" value="Handball" />
              </Picker>
            </View>

            <Input label="Tittel" value={form.title} onChangeText={(title) => onChange({ ...form, title })} placeholder="Eks: FC Oslo G13 soker kamp" />
            <Input label="Alder" value={form.ageGroup} onChangeText={(ageGroup) => onChange({ ...form, ageGroup })} placeholder="Eks: G13/J13" />
            <Input label="Niva" value={form.level} onChangeText={(level) => onChange({ ...form, level })} placeholder="Eks: Niva 1, 2 eller 3" />
            <Input label="Dato" value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="Eks: 15.06.2026" />
            <Input label="Tid" value={form.time} onChangeText={(time) => onChange({ ...form, time })} placeholder="Eks: 18:00" />
            <Input label="Sted" value={form.place} onChangeText={(place) => onChange({ ...form, place })} placeholder="Eks: Bisset Stadion" />
            <Input label="By/omrade" value={form.city} onChangeText={(city) => onChange({ ...form, city })} placeholder="Eks: Oslo" />
            <Input label="Type" value={form.matchType} onChangeText={(matchType) => onChange({ ...form, matchType })} placeholder="Eks: Treningskamp" />
            <Input
              label="Kommentar"
              value={form.comment}
              onChangeText={(comment) => onChange({ ...form, comment })}
              placeholder="Eks: Onsker jevn motstand"
              multiline
            />

            <Pressable style={styles.primaryButtonFull} onPress={onSubmit}>
              <Text style={styles.primaryButtonText}>Publiser kamp</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MatchDetailsModal({
  match,
  requests,
  onClose,
  onSendRequest
}: {
  match: Match | null;
  requests: MatchRequest[];
  onClose: () => void;
  onSendRequest: (match: Match) => void;
}) {
  if (!match) {
    return null;
  }

  const myRequest = requests.find(
    (request) => request.matchId === match.id && request.fromTeamId === currentProfile.id
  );
  const isOwnMatch = match.hostTeamId === currentProfile.id;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{match.title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.details}>
          <MatchCard match={match} hasMyRequest={Boolean(myRequest)} onPress={() => undefined} />

          <Text style={styles.sectionTitle}>Kampinfo</Text>
          <DetailRow label="Idrett" value={match.sport} />
          <DetailRow label="Alder" value={match.ageGroup} />
          <DetailRow label="Niva" value={match.level} />
          <DetailRow label="Dato" value={`${match.date} ${match.time}`} />
          <DetailRow label="Sted" value={`${match.place}, ${match.city}`} />
          <DetailRow label="Type" value={match.matchType} />

          <Text style={styles.sectionTitle}>Kontakt</Text>
          <DetailRow label="Klubb" value={match.hostClub} />
          <DetailRow label="Lag" value={match.hostTeam} />
          <DetailRow label="Kontaktperson" value={match.contactName} />

          <Text style={styles.sectionTitle}>Kommentar</Text>
          <Text style={styles.paragraph}>{match.comment || "Ingen kommentar."}</Text>

          {!isOwnMatch ? (
            <Pressable
              style={[
                styles.primaryButtonFull,
                (match.status === "avtalt" || Boolean(myRequest && myRequest.status !== "avslatt")) &&
                  styles.disabledButton
              ]}
              onPress={() => onSendRequest(match)}
            >
              <Text style={styles.primaryButtonText}>
                {myRequest && myRequest.status !== "avslatt" ? "Foresporsel sendt" : "Send foresporsel"}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.requestHint}>Dette er en kamp du har lagt ut.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function RequestDetailsModal({
  request,
  match,
  messages,
  messageText,
  onMessageTextChange,
  onSendChatMessage,
  onApprove,
  onDecline,
  onClose
}: {
  request: MatchRequest | null;
  match: Match | null;
  messages: ChatMessage[];
  messageText: string;
  onMessageTextChange: (text: string) => void;
  onSendChatMessage: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  if (!request || !match) {
    return null;
  }

  const isIncoming = match.hostTeamId === currentProfile.id;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Foresporsel</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboard}
        >
          <ScrollView contentContainerStyle={styles.details}>
            <Text style={styles.cardTitle}>{match.title}</Text>
            <Text style={styles.cardMeta}>{request.fromClub} {request.fromTeam}</Text>
            <RequestBadge status={request.status} />

            <Text style={styles.sectionTitle}>Status</Text>
            <Text style={styles.paragraph}>{getRequestText(request.status)}</Text>

            {isIncoming ? (
              <View style={styles.actionStack}>
                <Pressable style={styles.primaryButtonFull} onPress={onApprove}>
                  <Text style={styles.primaryButtonText}>Godkjenn</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} onPress={onDecline}>
                  <Text style={styles.dangerButtonText}>Avsla</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Chat</Text>
            <View style={styles.chatBox}>
              {messages.length === 0 ? <Text style={styles.cardMeta}>Ingen meldinger enda.</Text> : null}
              {messages.map((message) => (
                <View key={message.id} style={styles.messageBubble}>
                  <Text style={styles.messageSender}>{message.sender} · {message.createdAt}</Text>
                  <Text style={styles.messageText}>{message.text}</Text>
                </View>
              ))}
            </View>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={messageText}
                onChangeText={onMessageTextChange}
                placeholder="Skriv melding"
                placeholderTextColor={colors.muted}
              />
              <Pressable style={styles.sendButton} onPress={onSendChatMessage}>
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function BottomTabs({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: "home", label: "Hjem", icon: "home-outline" },
    { key: "matches", label: "Kamper", icon: "paper-plane-outline" },
    { key: "inbox", label: "Innboks", icon: "file-tray-outline" },
    { key: "mine", label: "Mine", icon: "person-outline" }
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <Pressable key={tab.key} style={styles.tabButton} onPress={() => onChange(tab.key)}>
            <Ionicons name={tab.icon} size={23} color={active ? colors.greenDark : colors.muted} />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={colors.greenDark} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
      />
    </View>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.readonlyField}>
        <Text style={styles.readonlyText}>{value}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function RequestBadge({ status }: { status: RequestStatus }) {
  const style =
    status === "avslatt"
      ? { backgroundColor: colors.redSoft, color: colors.red }
      : status === "godkjent"
        ? { backgroundColor: colors.greenDark, color: "#FFFFFF" }
        : { backgroundColor: colors.greenLight, color: colors.greenDark };

  return (
    <View style={[styles.requestBadge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.requestBadgeText, { color: style.color }]}>{formatRequestStatus(status)}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function getTabTitle(tab: Tab) {
  if (tab === "home") {
    return "Hjem";
  }
  if (tab === "matches") {
    return "Kamper";
  }
  if (tab === "inbox") {
    return "Innboks";
  }
  return "Mine";
}

function getMatchStatusStyle(status: MatchStatus) {
  if (status === "avtalt") {
    return {
      background: colors.greenDark,
      border: colors.greenDark,
      text: "#FFFFFF"
    };
  }

  return {
    background: colors.greenLight,
    border: colors.greenLight,
    text: colors.greenDark
  };
}

function formatRequestStatus(status: RequestStatus) {
  if (status === "godkjent") {
    return "Godkjent";
  }
  if (status === "avslatt") {
    return "Avslatt";
  }
  return "Ledig";
}

function getRequestText(status: RequestStatus) {
  if (status === "godkjent") {
    return "Denne foresporselen er godkjent, og kampen er avtalt.";
  }
  if (status === "avslatt") {
    return "Denne foresporselen er avslatt for deg. Kampen kan fortsatt vaere ledig for andre trenere.";
  }
  return "Foresporselen venter pa svar. Kampen vises fortsatt som ledig i markedet.";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.greenDark
  },
  app: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: 22,
    paddingBottom: 18,
    paddingTop: 16
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center"
  },
  content: {
    flex: 1
  },
  home: {
    flexGrow: 1,
    padding: 28,
    justifyContent: "center"
  },
  logo: {
    color: colors.black,
    fontSize: 44,
    fontWeight: "800",
    marginBottom: 22,
    textAlign: "center"
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 29,
    textAlign: "center"
  },
  heroText: {
    color: colors.greenDark,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 16,
    textAlign: "center"
  },
  homeActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 34
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: "800"
  },
  profileBox: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 34,
    padding: 16
  },
  sectionLabel: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase"
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  profileText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4
  },
  screen: {
    flex: 1
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  filterPill: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden"
  },
  compactPicker: {
    height: 48
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  list: {
    gap: 12,
    padding: 16,
    paddingBottom: 28
  },
  matchCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 2,
    padding: 16
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  cardText: {
    flex: 1
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4
  },
  cardDetails: {
    gap: 6,
    marginTop: 14
  },
  statusBadge: {
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusText: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  infoLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  infoText: {
    color: colors.text,
    flex: 1,
    fontSize: 14
  },
  requestHint: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12
  },
  requestCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 16
  },
  requestInfo: {
    flex: 1
  },
  requestBadge: {
    alignSelf: "flex-start",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  requestBadgeText: {
    fontSize: 12,
    fontWeight: "900"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 10
  },
  emptyState: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15
  },
  modalSafe: {
    backgroundColor: colors.background,
    flex: 1
  },
  modalKeyboard: {
    flex: 1
  },
  modalHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
  },
  modalTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 22,
    fontWeight: "900"
  },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44
  },
  form: {
    gap: 14,
    padding: 18,
    paddingBottom: 36
  },
  inputLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 7
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14
  },
  textArea: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: "top"
  },
  readonlyField: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  readonlyText: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: "700"
  },
  pickerField: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  primaryButtonFull: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18
  },
  disabledButton: {
    opacity: 0.65
  },
  details: {
    gap: 12,
    padding: 18,
    paddingBottom: 36
  },
  detailRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4
  },
  detailValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  paragraph: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23
  },
  actionStack: {
    gap: 10
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52
  },
  dangerButtonText: {
    color: colors.red,
    fontSize: 16,
    fontWeight: "900"
  },
  chatBox: {
    gap: 8
  },
  messageBubble: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  messageSender: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4
  },
  messageText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21
  },
  chatInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  chatInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  tabs: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 76,
    paddingBottom: 8,
    paddingTop: 8
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    justifyContent: "center"
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  tabLabelActive: {
    color: colors.greenDark
  }
});
