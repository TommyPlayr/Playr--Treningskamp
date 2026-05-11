import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Sport = "Fotball" | "Handball";
type Tab = "home" | "matches" | "inbox" | "mine";
type TabBadges = Partial<Record<Tab, number>>;
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

type DatabaseMatchRow = {
  id: string;
  sport: Sport;
  title: string;
  age_group: string;
  level: string;
  match_date: string;
  match_time: string | null;
  place: string;
  city: string;
  match_type: string;
  comment: string | null;
  status: MatchStatus;
  approved_request_id: string | null;
  host_team_id: string;
  teams:
    | {
        club: string;
        team: string;
        contact_name: string;
      }
    | null;
};

type DatabaseRequestRow = {
  id: string;
  match_id: string;
  from_team_id: string;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  teams:
    | {
        club: string;
        team: string;
      }
    | null;
};

type DatabaseChatMessageRow = {
  id: string;
  request_id: string;
  sender_user_id: string;
  text: string;
  created_at: string;
  users:
    | {
        full_name: string;
      }
    | null;
};

type DatabaseTeamRow = {
  id: string;
  sport: Sport;
  club: string;
  team: string;
  age_group: string;
  level: string;
  contact_name: string;
  users:
    | {
        email: string;
        phone: string | null;
      }
    | null;
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

const fallbackProfile: TeamProfile = {
  id: "10000000-0000-0000-0000-000000000001",
  sport: "Fotball",
  club: "FC Oslo",
  team: "G13",
  ageGroup: "G13",
  level: "Nivå 2",
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
  level: "Nivå 2",
  contactName: "Line Berg",
  phone: "911 11 111",
  email: "line@bisset.no"
};

const initialMatches: Match[] = [
  {
    id: "match-1",
    title: "G13 søker jevn kamp",
    sport: "Fotball",
    hostTeamId: opponentProfile.id,
    hostClub: opponentProfile.club,
    hostTeam: opponentProfile.team,
    ageGroup: "G13",
    level: "Nivå 2",
    date: "12.06.2026",
    time: "18:00",
    place: "Bisset Stadion",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Vi ønsker jevn motstand. Kan spille 3 x 25 minutter.",
    contactName: opponentProfile.contactName,
    status: "ledig"
  },
  {
    id: "match-2",
    title: "Kamp ønskes før sommerferien",
    sport: "Fotball",
    hostTeamId: "team-lyn",
    hostClub: "Lyn",
    hostTeam: "G13",
    ageGroup: "G13",
    level: "Nivå 1",
    date: "16.06.2026",
    time: "12:00",
    place: "Kringsja kunstgress",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Helst bortekamp, men kan stille bane ved behov.",
    contactName: "Marius Lie",
    status: "avtalt",
    approvedRequestId: "request-demo-lyn"
  },
  {
    id: "match-3",
    title: "G13 treningskamp på kunstgress",
    sport: "Fotball",
    hostTeamId: "team-kfum",
    hostClub: "KFUM",
    hostTeam: "G13",
    ageGroup: "G13",
    level: "Nivå 2",
    date: "18.06.2026",
    time: "19:00",
    place: "KFUM Arena",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Vi ønsker kamp mot lag på nivå 2 eller sterk nivå 3.",
    contactName: "Henrik Moen",
    status: "ledig"
  },
  {
    id: "match-4",
    title: "G13 motstand søkes",
    sport: "Fotball",
    hostTeamId: "team-baerum",
    hostClub: "Bærum SK",
    hostTeam: "G13",
    ageGroup: "G13",
    level: "Nivå 2",
    date: "21.06.2026",
    time: "14:00",
    place: "Kadettangen",
    city: "Bærum",
    matchType: "Treningskamp",
    comment: "Vi kan spille hjemme eller borte i Oslo/Viken.",
    contactName: "Anders Solberg",
    status: "avtalt",
    approvedRequestId: "request-demo-baerum"
  },
  {
    id: "match-5",
    title: "Søker treningskamp G13",
    sport: "Fotball",
    hostTeamId: "team-skeid",
    hostClub: "Skeid",
    hostTeam: "G13",
    ageGroup: "G13",
    level: "Nivå 2",
    date: "24.06.2026",
    time: "18:30",
    place: "Nordre Åsen",
    city: "Oslo",
    matchType: "Treningskamp",
    comment: "Fin uke for en ekstra treningskamp før ferien.",
    contactName: "Eirik Strand",
    status: "ledig"
  }
];

const initialRequests: MatchRequest[] = [
];

const initialMessages: ChatMessage[] = [
];

const readSeenNotifications = (profileId: string) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { incoming: 0, approved: 0 };
  }

  try {
    const saved = window.localStorage.getItem(`playr-seen-notifications-${profileId}`);
    if (!saved) {
      return { incoming: 0, approved: 0 };
    }

    const parsed = JSON.parse(saved);
    return {
      incoming: Number(parsed.incoming) || 0,
      approved: Number(parsed.approved) || 0
    };
  } catch {
    return { incoming: 0, approved: 0 };
  }
};

const saveSeenNotifications = (profileId: string, incoming: number, approved: number) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    `playr-seen-notifications-${profileId}`,
    JSON.stringify({ incoming, approved })
  );
};

const readSeenNotificationIds = (profileId: string) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { incoming: [] as string[], approved: [] as string[] };
  }

  try {
    const saved = window.localStorage.getItem(`playr-seen-notification-ids-${profileId}`);
    if (!saved) {
      return { incoming: [] as string[], approved: [] as string[] };
    }

    const parsed = JSON.parse(saved);
    return {
      incoming: Array.isArray(parsed.incoming) ? parsed.incoming.filter(Boolean) : [],
      approved: Array.isArray(parsed.approved) ? parsed.approved.filter(Boolean) : []
    };
  } catch {
    return { incoming: [] as string[], approved: [] as string[] };
  }
};

const saveSeenNotificationIds = (profileId: string, incoming: string[], approved: string[]) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    `playr-seen-notification-ids-${profileId}`,
    JSON.stringify({ incoming, approved })
  );
};

const mergeUniqueIds = (current: string[], next: string[]) => Array.from(new Set([...current, ...next]));

const createEmptyForm = (profile: TeamProfile) => ({
  sport: profile.sport,
  title: "",
  ageGroup: profile.ageGroup,
  level: "",
  date: "",
  time: "",
  place: "",
  city: "",
  matchType: "Treningskamp",
  comment: ""
});

const createFormFromMatch = (match: Match) => ({
  sport: match.sport,
  title: match.title,
  ageGroup: match.ageGroup,
  level: match.level,
  date: match.date,
  time: match.time,
  place: match.place,
  city: match.city,
  matchType: match.matchType,
  comment: match.comment
});

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [matches, setMatches] = useState<Match[]>(isSupabaseConfigured ? [] : initialMatches);
  const [requests, setRequests] = useState<MatchRequest[]>(isSupabaseConfigured ? [] : initialRequests);
  const [messages, setMessages] = useState<ChatMessage[]>(isSupabaseConfigured ? [] : initialMessages);
  const [currentProfile, setCurrentProfile] = useState<TeamProfile>(fallbackProfile);
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured);
  const [hasTeamProfile, setHasTeamProfile] = useState(!isSupabaseConfigured);
  const [appDataReady, setAppDataReady] = useState(!isSupabaseConfigured);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [profileEditVisible, setProfileEditVisible] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatFeedback, setChatFeedback] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [form, setForm] = useState(createEmptyForm(fallbackProfile));
  const [homeHeaderLogoVisible, setHomeHeaderLogoVisible] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<string | null>(null);
  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  const [isPublishingMatch, setIsPublishingMatch] = useState(false);
  const [isUpdatingMatch, setIsUpdatingMatch] = useState(false);
  const [editForm, setEditForm] = useState(createEmptyForm(fallbackProfile));
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [seenIncomingIds, setSeenIncomingIds] = useState<string[]>([]);
  const [seenApprovedIds, setSeenApprovedIds] = useState<string[]>([]);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;
  const editingMatch = matches.find((match) => match.id === editMatchId) ?? null;

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

  const pendingIncomingRequests = useMemo(
    () => incomingRequests.filter((request) => request.status === "venter"),
    [incomingRequests]
  );

  const approvedMyRequests = useMemo(
    () => myRequests.filter((request) => request.status === "godkjent"),
    [myRequests]
  );

  const pendingIncomingIds = useMemo(
    () => pendingIncomingRequests.map((request) => request.id),
    [pendingIncomingRequests]
  );

  const approvedMyRequestIds = useMemo(
    () => approvedMyRequests.map((request) => request.id),
    [approvedMyRequests]
  );

  const visibleIncomingNotificationCount = pendingIncomingRequests.filter(
    (request) => !seenIncomingIds.includes(request.id)
  ).length;

  const visibleApprovedNotificationCount = approvedMyRequests.filter(
    (request) => !seenApprovedIds.includes(request.id)
  ).length;

  useEffect(() => {
    if (activeTab === "mine") {
      setSeenIncomingIds((current) => mergeUniqueIds(current, pendingIncomingIds));
    }

    if (activeTab === "inbox") {
      setSeenApprovedIds((current) => mergeUniqueIds(current, approvedMyRequestIds));
    }
  }, [activeTab, pendingIncomingIds, approvedMyRequestIds]);

  useEffect(() => {
    setSeenIncomingIds((current) => current.filter((id) => pendingIncomingIds.includes(id)));
    setSeenApprovedIds((current) => current.filter((id) => approvedMyRequestIds.includes(id)));
  }, [pendingIncomingIds, approvedMyRequestIds]);

  useEffect(() => {
    const saved = readSeenNotificationIds(currentProfile.id);
    setSeenIncomingIds(saved.incoming);
    setSeenApprovedIds(saved.approved);
  }, [currentProfile.id]);

  useEffect(() => {
    saveSeenNotificationIds(currentProfile.id, seenIncomingIds, seenApprovedIds);
  }, [currentProfile.id, seenIncomingIds, seenApprovedIds]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
      setAuthUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setAuthUserId(session?.user.id ?? null);
      setProfileReady(!session?.user);
      setHasTeamProfile(false);
      setAppDataReady(!session?.user);
      setAuthReady(true);
      setSeenIncomingIds([]);
      setSeenApprovedIds([]);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadProfile = async () => {
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        return;
      }

      setProfileReady(false);

      const { data, error } = await supabase
        .from("teams")
        .select("id, sport, club, team, age_group, level, contact_name, users(email, phone)")
        .eq("user_id", authUserId)
        .limit(1)
        .maybeSingle();

      if (ignore) {
        return;
      }

      if (error) {
        setProfileReady(true);
        return;
      }

      if (data) {
        const profile = mapDatabaseTeam(data as DatabaseTeamRow);
        setCurrentProfile(profile);
        setForm(createEmptyForm(profile));
        setHasTeamProfile(true);
      } else {
        setHasTeamProfile(false);
      }

      setProfileReady(true);
    };

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [authUserId]);

  useEffect(() => {
    let ignore = false;

    const loadAppData = async () => {
      if (!isSupabaseConfigured || !supabase) {
        return;
      }

      if (!authUserId) {
        setAppDataReady(false);
        return;
      }

      setAppDataReady(false);

      let { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, sport, title, age_group, level, match_date, match_time, place, city, match_type, comment, status, approved_request_id, host_team_id, teams(club, team, contact_name)"
        )
        .order("match_date", { ascending: true });

      if (matchError) {
        const fallbackMatches = await supabase
          .from("matches")
          .select(
            "id, sport, title, age_group, level, match_date, match_time, place, city, match_type, comment, status, approved_request_id, host_team_id"
          )
          .order("match_date", { ascending: true });

        matchData = fallbackMatches.data;
        matchError = fallbackMatches.error;
      }

      const { data: requestData, error: requestError } = await supabase
        .from("match_requests")
        .select("id, match_id, from_team_id, message, status, created_at, teams(club, team)")
        .order("created_at", { ascending: false });

      const { data: messageData, error: messageError } = await supabase
        .from("chat_messages")
        .select("id, request_id, sender_user_id, text, created_at, users(full_name)")
        .order("created_at", { ascending: true });

      if (ignore) {
        return;
      }

      if (!matchError) {
        const loadedMatches = ((matchData ?? []) as DatabaseMatchRow[]).map(mapDatabaseMatch);
        setMatches(loadedMatches);
      }

      if (!requestError) {
        const loadedRequests = ((requestData ?? []) as DatabaseRequestRow[]).map(mapDatabaseRequest);
        setRequests(loadedRequests);
      }

      if (!messageError) {
        const loadedMessages = ((messageData ?? []) as DatabaseChatMessageRow[]).map(mapDatabaseChatMessage);
        setMessages(loadedMessages);
      }

      setAppDataReady(true);
    };

    loadAppData();

    return () => {
      ignore = true;
    };
  }, [authUserId]);

  useEffect(() => {
    setMessageText("");
    setChatFeedback(null);
  }, [selectedRequestId]);

  const createMatch = async () => {
    if (isPublishingMatch) {
      return;
    }

    setCreateFeedback(null);

    const cleanForm = {
      sport: form.sport,
      title: form.title.trim(),
      ageGroup: form.ageGroup.trim(),
      level: form.level.trim(),
      date: form.date.trim(),
      time: form.time.trim(),
      place: form.place.trim(),
      city: form.city.trim(),
      matchType: form.matchType.trim() || "Treningskamp",
      comment: form.comment.trim()
    };

    if (
      !cleanForm.title ||
      !cleanForm.ageGroup ||
      !cleanForm.level ||
      !cleanForm.date ||
      !cleanForm.time ||
      !cleanForm.place ||
      !cleanForm.city
    ) {
      setCreateFeedback("Fyll inn tittel, alder, nivå, dato, tid, sted og by før du publiserer kampen.");
      return;
    }

    const databaseDate = parseDateForDatabase(cleanForm.date);
    if (!databaseDate) {
      setCreateFeedback("Dato må skrives slik: 15.06.2026.");
      return;
    }

    if (isPastDatabaseDate(databaseDate)) {
      setCreateFeedback("Dato kan ikke være før dagens dato.");
      return;
    }

    const databaseTime = parseTimeForDatabase(cleanForm.time);
    if (!databaseTime) {
      setCreateFeedback("Tid må skrives slik: 18:00.");
      return;
    }

    const newMatchId = createLocalId();
    const newMatch: Match = {
      id: newMatchId,
      title: cleanForm.title,
      sport: cleanForm.sport,
      hostTeamId: currentProfile.id,
      hostClub: currentProfile.club,
      hostTeam: currentProfile.team,
      ageGroup: cleanForm.ageGroup,
      level: cleanForm.level,
      date: formatDatabaseDateForDisplay(databaseDate),
      time: databaseTime.slice(0, 5),
      place: cleanForm.place,
      city: cleanForm.city,
      matchType: cleanForm.matchType,
      comment: cleanForm.comment,
      contactName: currentProfile.contactName,
      status: "ledig"
    };

    setMatches((current) => [newMatch, ...current]);
    setForm(createEmptyForm(currentProfile));
    setCreateVisible(false);
    setActiveTab("mine");
    setIsPublishingMatch(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from("matches")
          .insert({
            id: newMatchId,
            host_team_id: currentProfile.id,
            sport: cleanForm.sport,
            title: cleanForm.title,
            age_group: cleanForm.ageGroup,
            level: cleanForm.level,
            match_date: databaseDate,
            match_time: databaseTime,
            place: cleanForm.place,
            city: cleanForm.city,
            match_type: cleanForm.matchType,
            comment: cleanForm.comment,
            status: "ledig"
          });

        if (error) {
          return;
        }
      }
    } finally {
      setIsPublishingMatch(false);
    }
  };

  const openEditMatch = (match: Match) => {
    if (match.hostTeamId !== currentProfile.id) {
      return;
    }

    setSelectedMatchId(null);
    setEditForm(createFormFromMatch(match));
    setEditFeedback(null);
    setEditMatchId(match.id);
  };

  const updateHostedMatch = async () => {
    const editingMatch = matches.find((match) => match.id === editMatchId) ?? null;

    if (!editingMatch || isUpdatingMatch) {
      return;
    }

    setEditFeedback(null);

    const cleanForm = {
      sport: editForm.sport,
      title: editForm.title.trim(),
      ageGroup: editForm.ageGroup.trim(),
      level: editForm.level.trim(),
      date: editForm.date.trim(),
      time: editForm.time.trim(),
      place: editForm.place.trim(),
      city: editForm.city.trim(),
      matchType: editForm.matchType.trim() || "Treningskamp",
      comment: editForm.comment.trim()
    };

    if (
      !cleanForm.title ||
      !cleanForm.ageGroup ||
      !cleanForm.level ||
      !cleanForm.date ||
      !cleanForm.time ||
      !cleanForm.place ||
      !cleanForm.city
    ) {
      setEditFeedback("Fyll inn tittel, alder, nivå, dato, tid, sted og by før du lagrer.");
      return;
    }

    const databaseDate = parseDateForDatabase(cleanForm.date);
    if (!databaseDate) {
      setEditFeedback("Dato må skrives slik: 15.06.2026.");
      return;
    }

    if (isPastDatabaseDate(databaseDate)) {
      setEditFeedback("Dato kan ikke være før dagens dato.");
      return;
    }

    const databaseTime = parseTimeForDatabase(cleanForm.time);
    if (!databaseTime) {
      setEditFeedback("Tid må skrives slik: 18:00.");
      return;
    }

    const updatedMatch: Match = {
      ...editingMatch,
      title: cleanForm.title,
      sport: cleanForm.sport,
      ageGroup: cleanForm.ageGroup,
      level: cleanForm.level,
      date: formatDatabaseDateForDisplay(databaseDate),
      time: databaseTime.slice(0, 5),
      place: cleanForm.place,
      city: cleanForm.city,
      matchType: cleanForm.matchType,
      comment: cleanForm.comment
    };

    const previousMatches = matches;
    setMatches((current) => current.map((match) => (match.id === updatedMatch.id ? updatedMatch : match)));
    setIsUpdatingMatch(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("matches")
          .update({
            sport: cleanForm.sport,
            title: cleanForm.title,
            age_group: cleanForm.ageGroup,
            level: cleanForm.level,
            match_date: databaseDate,
            match_time: databaseTime,
            place: cleanForm.place,
            city: cleanForm.city,
            match_type: cleanForm.matchType,
            comment: cleanForm.comment
          })
          .eq("id", editingMatch.id)
          .eq("host_team_id", currentProfile.id)
          .select(
            "id, sport, title, age_group, level, match_date, match_time, place, city, match_type, comment, status, approved_request_id, host_team_id, teams(club, team, contact_name)"
          )
          .single();

        if (error) {
          setMatches(previousMatches);
          setEditFeedback(getReadableErrorMessage(error, "Kampen ble ikke lagret."));
          return;
        }

        if (data) {
          const savedMatch = mapDatabaseMatch(data as DatabaseMatchRow);
          setMatches((current) => current.map((match) => (match.id === savedMatch.id ? savedMatch : match)));
        }
      }

      setEditMatchId(null);
    } finally {
      setIsUpdatingMatch(false);
    }
  };

  const deleteHostedMatch = async (match: Match) => {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm("Slette kamp? Kampen fjernes helt fra appen.")
        : true;

    if (!confirmed) {
      return;
    }

    const previousMatches = matches;
    const previousRequests = requests;
    const previousMessages = messages;
    const requestIds = new Set(
      requests.filter((request) => request.matchId === match.id).map((request) => request.id)
    );

    setSelectedMatchId(null);
    setMatches((current) => current.filter((item) => item.id !== match.id));
    setRequests((current) => current.filter((request) => request.matchId !== match.id));
    setMessages((current) => current.filter((message) => !requestIds.has(message.requestId)));

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("matches")
        .update({ status: "ledig", approved_request_id: null })
        .eq("id", match.id)
        .eq("host_team_id", currentProfile.id);

      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", match.id)
        .eq("host_team_id", currentProfile.id);

      if (error) {
        setMatches(previousMatches);
        setRequests(previousRequests);
        setMessages(previousMessages);

        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert(`Kampen ble ikke slettet: ${getReadableErrorMessage(error)}`);
        } else {
          Alert.alert("Kampen ble ikke slettet", getReadableErrorMessage(error));
        }
      }
    }
  };

  const showEditComingSoon = () => {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert("Redigering kobles på i neste steg.");
    } else {
      Alert.alert("Rediger kamp", "Redigering kobles på i neste steg.");
    }
  };

  const sendRequest = async (match: Match) => {
    if (isSendingRequest) {
      return;
    }

    if (match.hostTeamId === currentProfile.id) {
      Alert.alert("Dette er din kamp", "Du kan ikke sende forespørsel på en kamp du selv har lagt ut.");
      return;
    }

    if (match.status === "avtalt") {
      Alert.alert("Kampen er avtalt", "Denne kampen har allerede fått motstander.");
      return;
    }

    const existing = requests.find(
      (request) => request.matchId === match.id && request.fromTeamId === currentProfile.id
    );

    if (existing && existing.status !== "avslatt") {
      Alert.alert("Forespørsel finnes", "Du har allerede sendt forespørsel på denne kampen.");
      return;
    }

    setIsSendingRequest(true);

    const request: MatchRequest = {
      id: createLocalId(),
      matchId: match.id,
      fromTeamId: currentProfile.id,
      fromClub: currentProfile.club,
      fromTeam: currentProfile.team,
      message: `${formatTeamName(currentProfile.club, currentProfile.team)} vil gjerne spille denne kampen.`,
      status: "venter",
      createdAt: "Nå"
    };

    setRequests((current) => [request, ...current]);
    setSelectedMatchId(null);
    setActiveTab("mine");

    try {
      if (isSupabaseConfigured && supabase) {
        const { data: existingRequest, error: lookupError } = await supabase
          .from("match_requests")
          .select("id, match_id, from_team_id, message, status, created_at, teams(club, team)")
          .eq("match_id", match.id)
          .eq("from_team_id", currentProfile.id)
          .maybeSingle();

        if (lookupError) {
          setRequests((current) => current.filter((item) => item.id !== request.id));
          Alert.alert("Forespørselen ble ikke sendt", getReadableErrorMessage(lookupError));
          return;
        }

        if (existingRequest) {
          const savedRequest = mapDatabaseRequest(existingRequest as DatabaseRequestRow);

          if (savedRequest.status !== "avslatt") {
            setRequests((current) => replaceRequest(current, request.id, savedRequest));
            Alert.alert("Forespørsel finnes", "Du har allerede sendt forespørsel på denne kampen.");
            return;
          }

          const { data: updatedRequest, error: updateError } = await supabase
            .from("match_requests")
            .update({ status: "venter", message: request.message })
            .eq("id", savedRequest.id)
            .select("id, match_id, from_team_id, message, status, created_at, teams(club, team)")
            .single();

          if (updateError) {
            setRequests((current) => current.filter((item) => item.id !== request.id));
            Alert.alert("Forespørselen ble ikke sendt", getReadableErrorMessage(updateError));
            return;
          }

          setRequests((current) =>
            replaceRequest(current, request.id, mapDatabaseRequest(updatedRequest as DatabaseRequestRow))
          );
          return;
        }

        const { data, error } = await supabase
          .from("match_requests")
          .insert({
            id: request.id,
            match_id: match.id,
            from_team_id: currentProfile.id,
            message: request.message,
            status: "venter"
          })
          .select("id, match_id, from_team_id, message, status, created_at, teams(club, team)")
          .single();

        if (error) {
          setRequests((current) => current.filter((item) => item.id !== request.id));
          Alert.alert("Forespørselen ble ikke sendt", getReadableErrorMessage(error));
          return;
        }

        if (data) {
          const savedRequest = mapDatabaseRequest(data as DatabaseRequestRow);
          setRequests((current) => replaceRequest(current, request.id, savedRequest));
        }
      }
    } finally {
      setIsSendingRequest(false);
    }
  };

  const approveRequest = async (request: MatchRequest) => {
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

    if (isSupabaseConfigured && supabase) {
      await supabase.from("match_requests").update({ status: "godkjent" }).eq("id", request.id);
      await supabase
        .from("match_requests")
        .update({ status: "avslatt" })
        .eq("match_id", request.matchId)
        .eq("status", "venter")
        .neq("id", request.id);
      await supabase
        .from("matches")
        .update({ status: "avtalt", approved_request_id: request.id })
        .eq("id", request.matchId);
    }
  };

  const declineRequest = async (request: MatchRequest) => {
    const shouldReopenMatch =
      request.status === "godkjent" ||
      matches.some((match) => match.id === request.matchId && match.approvedRequestId === request.id);

    setRequests((current) =>
      current.map((item) => (item.id === request.id ? { ...item, status: "avslatt" } : item))
    );

    setMatches((current) =>
      current.map((match) => {
        if (match.id !== request.matchId || !shouldReopenMatch) {
          return match;
        }
        return { ...match, status: "ledig", approvedRequestId: undefined };
      })
    );

    if (isSupabaseConfigured && supabase) {
      await supabase.from("match_requests").update({ status: "avslatt" }).eq("id", request.id);

      if (shouldReopenMatch) {
        await supabase
          .from("matches")
          .update({ status: "ledig", approved_request_id: null })
          .eq("id", request.matchId);
      }
    }
  };

  const withdrawRequest = async (request: MatchRequest) => {
    const shouldReopenMatch =
      request.status === "godkjent" ||
      matches.some((match) => match.id === request.matchId && match.approvedRequestId === request.id);

    setRequests((current) => current.filter((item) => item.id !== request.id));
    setMessages((current) => current.filter((message) => message.requestId !== request.id));

    if (shouldReopenMatch) {
      setMatches((current) =>
        current.map((match) =>
          match.id === request.matchId
            ? { ...match, status: "ledig", approvedRequestId: undefined }
            : match
        )
      );
    }

    setSelectedRequestId(null);
    setActiveTab("matches");

    if (isSupabaseConfigured && supabase) {
      await supabase.from("match_requests").delete().eq("id", request.id);

      if (shouldReopenMatch) {
        await supabase
          .from("matches")
          .update({ status: "ledig", approved_request_id: null })
          .eq("id", request.matchId);
      }
    }
  };

  const saveProfileChanges = async (profile: TeamProfile) => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      setCurrentProfile(profile);
      setForm(createEmptyForm(profile));
      setProfileEditVisible(false);
      return;
    }

    const { error: userError } = await supabase.from("users").upsert({
      id: authUserId,
      full_name: profile.contactName,
      email: profile.email,
      phone: profile.phone.trim() || null
    });

    if (userError) {
      throw userError;
    }

    const { data, error: teamError } = await supabase
      .from("teams")
      .update({
        sport: profile.sport,
        club: profile.team,
        team: profile.team,
        age_group: profile.ageGroup,
        contact_name: profile.contactName
      })
      .eq("id", profile.id)
      .select("id, sport, club, team, age_group, level, contact_name, users(email, phone)")
      .single();

    if (teamError) {
      throw teamError;
    }

    const updatedProfile = data ? mapDatabaseTeam(data as DatabaseTeamRow) : profile;
    setCurrentProfile(updatedProfile);
    setForm(createEmptyForm(updatedProfile));
    setMatches((current) =>
      current.map((match) =>
        match.hostTeamId === updatedProfile.id
          ? {
              ...match,
              sport: updatedProfile.sport,
              hostClub: updatedProfile.club,
              hostTeam: updatedProfile.team,
              contactName: updatedProfile.contactName
            }
          : match
      )
    );
    setRequests((current) =>
      current.map((request) =>
        request.fromTeamId === updatedProfile.id
          ? { ...request, fromClub: updatedProfile.club, fromTeam: updatedProfile.team }
          : request
      )
    );
    setProfileEditVisible(false);
  };

  const sendChatMessage = async () => {
    if (!selectedRequest || isSendingMessage) {
      return;
    }

    const text = messageText.trim();
    if (text.length < 2) {
      setChatFeedback("Skriv en litt tydeligere melding før du sender.");
      return;
    }

    setIsSendingMessage(true);
    setChatFeedback(null);
    let chatMessage: ChatMessage | null = null;

    try {
      if (!isSupabaseConfigured || !supabase) {
        chatMessage = {
          id: createLocalId(),
          requestId: selectedRequest.id,
          sender: currentProfile.contactName,
          text,
          createdAt: "Nå"
        };
        setMessages((current) => [...current, chatMessage as ChatMessage]);
        setMessageText("");
        return;
      }

      if (!isUuid(selectedRequest.id) || !isUuid(selectedRequest.matchId)) {
        chatMessage = {
          id: createLocalId(),
          requestId: selectedRequest.id,
          sender: currentProfile.contactName,
          text,
          createdAt: "Nå"
        };
        setMessages((current) => [...current, chatMessage as ChatMessage]);
        setMessageText("");
        setChatFeedback("Meldingen er bare lagret lokalt fordi dette er en gammel testkamp.");
        return;
      }

      if (!authUserId) {
        throw new Error("Du må være innlogget for å sende melding.");
      }

      let requestIdForChat = selectedRequest.id;
      const { data: requestById, error: requestLookupError } = await supabase
        .from("match_requests")
        .select("id")
        .eq("id", selectedRequest.id)
        .maybeSingle();

      if (requestLookupError) {
        throw requestLookupError;
      }

      if (!requestById) {
        const { data: requestByTeam, error: teamRequestLookupError } = await supabase
          .from("match_requests")
          .select("id")
          .eq("match_id", selectedRequest.matchId)
          .eq("from_team_id", selectedRequest.fromTeamId)
          .maybeSingle();

        if (teamRequestLookupError) {
          throw teamRequestLookupError;
        }

        if (requestByTeam?.id) {
          requestIdForChat = requestByTeam.id;
        } else {
          const { data: createdRequest, error: createRequestError } = await supabase
            .from("match_requests")
            .insert({
              id: selectedRequest.id,
              match_id: selectedRequest.matchId,
              from_team_id: selectedRequest.fromTeamId,
              message: selectedRequest.message,
              status: selectedRequest.status
            })
            .select("id")
            .single();

          if (createRequestError) {
            throw createRequestError;
          }

          requestIdForChat = createdRequest.id;
        }

        if (requestIdForChat !== selectedRequest.id) {
          setRequests((current) =>
            current.map((request) =>
              request.id === selectedRequest.id ? { ...request, id: requestIdForChat } : request
            )
          );
          setSelectedRequestId(requestIdForChat);
        }
      }

      chatMessage = {
        id: createLocalId(),
        requestId: requestIdForChat,
        sender: currentProfile.contactName,
        text,
        createdAt: "Nå"
      };

      setMessages((current) => [...current, chatMessage as ChatMessage]);
      setMessageText("");

      const { error } = await supabase.from("chat_messages").insert({
        id: chatMessage.id,
        request_id: requestIdForChat,
        sender_user_id: authUserId,
        text
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      if (chatMessage) {
        setMessages((current) => current.filter((message) => message.id !== chatMessage?.id));
      }
      setMessageText(text);
      setChatFeedback(getErrorMessage(error));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const renderContent = () => {
    if (activeTab === "home") {
      return (
        <HomeScreen
          profile={currentProfile}
          matches={matches}
          onFindMatches={() => setActiveTab("matches")}
          onCreateMatch={() => setCreateVisible(true)}
          onOpenMatch={(id) => setSelectedMatchId(id)}
          onHeaderLogoChange={setHomeHeaderLogoVisible}
          pendingIncomingCount={visibleIncomingNotificationCount}
          approvedMyRequestsCount={visibleApprovedNotificationCount}
          onOpenInbox={() => {
            setSeenIncomingIds((current) => mergeUniqueIds(current, pendingIncomingIds));
            setActiveTab("mine");
          }}
          onOpenMine={() => {
            setSeenApprovedIds((current) => mergeUniqueIds(current, approvedMyRequestIds));
            setActiveTab("inbox");
          }}
        />
      );
    }

    if (activeTab === "matches") {
      return (
        <MatchesScreen
          profile={currentProfile}
          matches={matches}
          requests={requests}
          onOpenMatch={(id) => setSelectedMatchId(id)}
          onCreateMatch={() => setCreateVisible(true)}
        />
      );
    }

    if (activeTab === "inbox") {
      return (
        <AgreedMatchesScreen
          profile={currentProfile}
          matches={matches}
          requests={requests}
          onOpenMatch={(id) => setSelectedMatchId(id)}
        />
      );
    }

    return (
      <MineScreen
        profile={currentProfile}
        hostedMatches={myHostedMatches}
        myRequests={myRequests}
        requests={requests}
        incomingRequests={incomingRequests}
        matches={matches}
        userEmail={userEmail}
        onEditProfile={() => setProfileEditVisible(true)}
        onSignOut={async () => {
          await supabase?.auth.signOut();
          setUserEmail(null);
          setAuthUserId(null);
          setHasTeamProfile(false);
          setCurrentProfile(fallbackProfile);
          setProfileEditVisible(false);
          setSeenIncomingIds([]);
          setSeenApprovedIds([]);
        }}
        onOpenMatch={(id) => setSelectedMatchId(id)}
        onOpenRequest={(id) => setSelectedRequestId(id)}
      />
    );
  };

  if (isSupabaseConfigured && !authReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.loadingText}>Starter Playr...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isSupabaseConfigured && !userEmail) {
    return <AuthScreen />;
  }

  if (isSupabaseConfigured && !profileReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.loadingText}>Henter lagprofil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isSupabaseConfigured && authUserId && userEmail && !hasTeamProfile) {
    return (
      <TeamProfileScreen
        authUserId={authUserId}
        email={userEmail}
        onProfileCreated={(profile) => {
          setCurrentProfile(profile);
          setForm(createEmptyForm(profile));
          setHasTeamProfile(true);
        }}
      />
    );
  }

  if (isSupabaseConfigured && hasTeamProfile && !appDataReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.green} size="large" />
          <Text style={styles.loadingText}>Henter kamper og forespørsler...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <Header
          title={getTabTitle(activeTab)}
          profile={currentProfile}
          showHomeLogo={activeTab === "home" && homeHeaderLogoVisible}
        />
        <View style={styles.content}>{renderContent()}</View>
        <BottomTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          badges={{ inbox: visibleIncomingNotificationCount, mine: visibleApprovedNotificationCount }}
        />
      </View>

      <CreateMatchModal
        visible={createVisible}
        profile={currentProfile}
        form={form}
        feedback={createFeedback}
        isPublishing={isPublishingMatch}
        onChange={setForm}
        onClose={() => setCreateVisible(false)}
        onSubmit={createMatch}
      />

      <EditMatchModal
        match={editingMatch}
        form={editForm}
        feedback={editFeedback}
        isSaving={isUpdatingMatch}
        onChange={setEditForm}
        onClose={() => setEditMatchId(null)}
        onSubmit={updateHostedMatch}
      />

      <ProfileEditModal
        visible={profileEditVisible}
        profile={currentProfile}
        onClose={() => setProfileEditVisible(false)}
        onSave={saveProfileChanges}
      />

      <MatchDetailsModal
        match={selectedMatch}
        profile={currentProfile}
        requests={requests}
        isSendingRequest={isSendingRequest}
        onClose={() => setSelectedMatchId(null)}
        onSendRequest={sendRequest}
        onEditMatch={openEditMatch}
        onDeleteMatch={deleteHostedMatch}
      />

      <RequestDetailsModal
        request={selectedRequest}
        profile={currentProfile}
        match={selectedRequest ? matches.find((item) => item.id === selectedRequest.matchId) ?? null : null}
        messages={selectedRequest ? messages.filter((message) => message.requestId === selectedRequest.id) : []}
        messageText={messageText}
        chatFeedback={chatFeedback}
        isSendingMessage={isSendingMessage}
        onMessageTextChange={setMessageText}
        onSendChatMessage={sendChatMessage}
        onApprove={() => selectedRequest && approveRequest(selectedRequest)}
        onDecline={() => selectedRequest && declineRequest(selectedRequest)}
        onWithdraw={() => selectedRequest && withdrawRequest(selectedRequest)}
        onClose={() => setSelectedRequestId(null)}
      />
    </SafeAreaView>
  );
}

function Header({
  title,
  profile,
  showHomeLogo
}: {
  title: string;
  profile: TeamProfile;
  showHomeLogo: boolean;
}) {
  return (
    <View style={styles.header}>
      {title ? (
        <Text style={styles.headerTitle}>{title}</Text>
      ) : (
        <Text style={styles.headerProfileText}>
          {profile.contactName} · {profile.team}
        </Text>
      )}
      {showHomeLogo ? <PlayrLogo compact /> : null}
    </View>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!supabase) {
      setFeedback("Supabase er ikke konfigurert.");
      return;
    }

    if (!email.trim() || password.length < 6) {
      setFeedback("Skriv e-post og passord på minst 6 tegn.");
      return;
    }

    setLoading(true);
    setFeedback(null);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

    setLoading(false);

    if (result.error) {
      setFeedback(getReadableErrorMessage(result.error));
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setFeedback("Brukeren er opprettet. Sjekk e-posten din for bekreftelse før innlogging.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.authScreen}
      >
        <PlayrLogo />
        <Text style={styles.authTitle}>
          {mode === "login" ? "Logg inn som trener" : "Opprett trenerbruker"}
        </Text>
        <Text style={styles.authText}>
          Bruk e-post og passord for å logge inn i Playr.
        </Text>

        <View style={styles.authForm}>
          <Input
            label="E-post"
            value={email}
            onChangeText={setEmail}
            placeholder="navn@klubb.no"
          />
          <Input
            label="Passord"
            value={password}
            onChangeText={setPassword}
            placeholder="Minst 6 tegn"
          />

          {feedback ? <Text style={styles.formFeedback}>{feedback}</Text> : null}

          <Pressable style={[styles.primaryButtonFull, loading && styles.disabledButton]} disabled={loading} onPress={submit}>
            <Text style={styles.primaryButtonText}>
              {loading ? "Vent..." : mode === "login" ? "Logg inn" : "Opprett bruker"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.authModeButton}
            onPress={() => {
              setFeedback(null);
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            <Text style={styles.authModeText}>
              {mode === "login" ? "Ny bruker? Opprett konto" : "Har du konto? Logg inn"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TeamProfileScreen({
  authUserId,
  email,
  onProfileCreated
}: {
  authUserId: string;
  email: string;
  onProfileCreated: (profile: TeamProfile) => void;
}) {
  const [contactName, setContactName] = useState("");
  const [sport, setSport] = useState<Sport>("Fotball");
  const [team, setTeam] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [phone, setPhone] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (!supabase) {
      setFeedback("Supabase er ikke konfigurert.");
      return;
    }

    if (!contactName.trim() || !team.trim() || !ageGroup.trim()) {
      setFeedback("Fyll inn trenernavn, lag og alder.");
      return;
    }

    setSaving(true);
    setFeedback(null);

    const userPayload = {
      id: authUserId,
      full_name: contactName.trim(),
      email,
      phone: phone.trim() || null
    };

    const { error: userError } = await supabase.from("users").upsert(userPayload);

    if (userError) {
      setSaving(false);
      setFeedback(getReadableErrorMessage(userError));
      return;
    }

    const { data, error: teamError } = await supabase
      .from("teams")
      .insert({
        user_id: authUserId,
        sport,
        club: team.trim(),
        team: team.trim(),
        age_group: ageGroup.trim(),
        level: "",
        contact_name: contactName.trim()
      })
      .select("id, sport, club, team, age_group, level, contact_name, users(email, phone)")
      .single();

    setSaving(false);

    if (teamError) {
      setFeedback(getReadableErrorMessage(teamError));
      return;
    }

    if (data) {
      onProfileCreated(mapDatabaseTeam(data as DatabaseTeamRow));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.authScreen}
      >
        <ScrollView contentContainerStyle={styles.profileSetupContent}>
          <PlayrLogo />
          <Text style={styles.authTitle}>Opprett lagprofil</Text>
          <Text style={styles.authText}>
            Lagprofilen må fylles ut før du kan bruke appen.
          </Text>

          <View style={styles.authForm}>
            <Input
              label="Trenernavn"
              value={contactName}
              onChangeText={setContactName}
              placeholder="Eks: Tommy Hansen"
            />

            <Text style={styles.inputLabel}>Idrett</Text>
            <View style={styles.pickerField}>
              <Picker selectedValue={sport} onValueChange={(value: Sport) => setSport(value)}>
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Håndball" value="Handball" />
              </Picker>
            </View>

            <Input
              label="Lag"
              value={team}
              onChangeText={setTeam}
              placeholder="Eks: Lyn Akademi"
            />
            <Input
              label="Alder"
              value={ageGroup}
              onChangeText={setAgeGroup}
              placeholder="Eks: G13"
            />
            <Input
              label="Telefon (valgfritt)"
              value={phone}
              onChangeText={setPhone}
              placeholder="Eks: 900 00 000"
            />
            <ReadonlyField label="E-post" value={email} />

            {feedback ? <Text style={styles.formFeedback}>{feedback}</Text> : null}

            <Pressable style={[styles.primaryButtonFull, saving && styles.disabledButton]} disabled={saving} onPress={saveProfile}>
              <Text style={styles.primaryButtonText}>
                {saving ? "Lagrer..." : "Lagre lagprofil"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileEditModal({
  visible,
  profile,
  onClose,
  onSave
}: {
  visible: boolean;
  profile: TeamProfile;
  onClose: () => void;
  onSave: (profile: TeamProfile) => Promise<void>;
}) {
  const [contactName, setContactName] = useState(profile.contactName);
  const [sport, setSport] = useState<Sport>(profile.sport);
  const [team, setTeam] = useState(profile.team);
  const [ageGroup, setAgeGroup] = useState(profile.ageGroup);
  const [phone, setPhone] = useState(profile.phone);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setContactName(profile.contactName);
    setSport(profile.sport);
    setTeam(profile.team);
    setAgeGroup(profile.ageGroup);
    setPhone(profile.phone);
    setFeedback(null);
  }, [visible, profile]);

  const save = async () => {
    if (!contactName.trim() || !team.trim() || !ageGroup.trim()) {
      setFeedback("Fyll inn trenernavn, lag og alder.");
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await onSave({
        ...profile,
        contactName: contactName.trim(),
        sport,
        club: team.trim(),
        team: team.trim(),
        ageGroup: ageGroup.trim(),
        phone: phone.trim()
      });
    } catch (error) {
      setFeedback(getReadableErrorMessage(error, "Profilen kunne ikke lagres."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboard}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rediger lagprofil</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.details}>
            <Input
              label="Trenernavn"
              value={contactName}
              onChangeText={setContactName}
              placeholder="Eks: Tommy Hansen"
            />

            <Text style={styles.inputLabel}>Idrett</Text>
            <View style={styles.pickerField}>
              <Picker selectedValue={sport} onValueChange={(value: Sport) => setSport(value)}>
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Håndball" value="Handball" />
              </Picker>
            </View>

            <Input
              label="Lag"
              value={team}
              onChangeText={setTeam}
              placeholder="Eks: Glassverket IF"
            />
            <Input
              label="Alder"
              value={ageGroup}
              onChangeText={setAgeGroup}
              placeholder="Eks: G13"
            />
            <Input
              label="Telefon (valgfritt)"
              value={phone}
              onChangeText={setPhone}
              placeholder="Eks: 900 00 000"
            />
            <ReadonlyField label="E-post" value={profile.email} />

            {feedback ? <Text style={styles.formFeedback}>{feedback}</Text> : null}

            <Pressable style={[styles.primaryButtonFull, saving && styles.disabledButton]} disabled={saving} onPress={save}>
              <Text style={styles.primaryButtonText}>
                {saving ? "Lagrer..." : "Lagre endringer"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function PlayrLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.logoMarkWrap, compact && styles.logoMarkWrapCompact]}>
      <View style={[styles.logoIcon, compact && styles.logoIconCompact]}>
        <View style={[styles.logoDot, styles.logoDotLeft, compact && styles.logoDotCompact]} />
        <View style={[styles.logoDot, styles.logoDotRight, compact && styles.logoDotCompact]} />
        <View style={[styles.logoArc, styles.logoArcTop, compact && styles.logoArcCompact]} />
        <View style={[styles.logoArc, styles.logoArcBottom, compact && styles.logoArcCompact]} />
      </View>
      <Text style={[styles.logo, compact && styles.logoCompact]}>Playr</Text>
    </View>
  );
}

function HomeScreen({
  profile,
  matches,
  onFindMatches,
  onCreateMatch,
  onOpenMatch,
  onHeaderLogoChange,
  pendingIncomingCount,
  approvedMyRequestsCount,
  onOpenInbox,
  onOpenMine
}: {
  profile: TeamProfile;
  matches: Match[];
  onFindMatches: () => void;
  onCreateMatch: () => void;
  onOpenMatch: (id: string) => void;
  onHeaderLogoChange: (visible: boolean) => void;
  pendingIncomingCount: number;
  approvedMyRequestsCount: number;
  onOpenInbox: () => void;
  onOpenMine: () => void;
}) {
  const relevantMatches = matches.filter(
    (match) =>
      match.status === "ledig" &&
      match.sport === profile.sport &&
      match.ageGroup === profile.ageGroup &&
      match.hostTeamId !== profile.id
  );
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const activeMatch = relevantMatches[activeMatchIndex % Math.max(relevantMatches.length, 1)];
  const showNextMatch = () => {
    if (relevantMatches.length <= 1) {
      return;
    }
    setActiveMatchIndex((current) => (current + 1) % relevantMatches.length);
  };
  const showPreviousMatch = () => {
    if (relevantMatches.length <= 1) {
      return;
    }
    setActiveMatchIndex((current) => (current - 1 + relevantMatches.length) % relevantMatches.length);
  };
  const featuredSwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -30) {
            showNextMatch();
          }
          if (gesture.dx > 30) {
            showPreviousMatch();
          }
        }
      }),
    [relevantMatches.length]
  );

  useEffect(() => {
    if (relevantMatches.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setActiveMatchIndex((current) => (current + 1) % relevantMatches.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [relevantMatches.length]);

  return (
    <ScrollView
      contentContainerStyle={styles.home}
      onScroll={(event) => onHeaderLogoChange(event.nativeEvent.contentOffset.y > 36)}
      scrollEventThrottle={16}
    >
      <PlayrLogo />
      <Text style={styles.heroTitle}>En enklere hverdag for trenere.</Text>
      <Text style={styles.heroText}>
        Finn og avtal treningskamper raskt og enkelt.
      </Text>
      <Text style={[styles.heroText, styles.heroTextSecond]}>
        Trykk Finn kamper for å se ledige motstandere, eller Legg ut kamp for å finne
        motstander.
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

      {pendingIncomingCount > 0 || approvedMyRequestsCount > 0 ? (
        <View style={styles.notificationPanel}>
          {pendingIncomingCount > 0 ? (
            <Pressable style={styles.notificationRow} onPress={onOpenInbox}>
              <Ionicons name="notifications-outline" size={18} color={colors.green} />
              <Text style={styles.notificationText}>
                {pendingIncomingCount === 1
                  ? "Du har 1 ny forespørsel i innboksen."
                  : `Du har ${pendingIncomingCount} nye forespørsler i innboksen.`}
              </Text>
            </Pressable>
          ) : null}
          {approvedMyRequestsCount > 0 ? (
            <Pressable style={styles.notificationRow} onPress={onOpenMine}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.green} />
              <Text style={styles.notificationText}>
                {approvedMyRequestsCount === 1
                  ? "1 kamp er godkjent av motstander."
                  : `${approvedMyRequestsCount} kamper er godkjent av motstander.`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.featuredArea,
          (pendingIncomingCount > 0 || approvedMyRequestsCount > 0) && styles.featuredAreaWithNotification
        ]}
      >
        <Text style={styles.featuredTitle}>Kamper i nærheten</Text>
        {activeMatch ? (
          <View style={styles.featuredCard} {...featuredSwipe.panHandlers}>
            <Pressable style={styles.featuredCardButton} onPress={() => onOpenMatch(activeMatch.id)}>
              <View style={styles.featuredTop}>
                <Text style={styles.featuredClub}>
                  {formatTeamName(activeMatch.hostClub, activeMatch.hostTeam)}
                </Text>
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>Ledig</Text>
                </View>
              </View>
              <Text style={styles.featuredMeta}>
                {activeMatch.date} · {activeMatch.time} · {activeMatch.city}
              </Text>
              <Text style={styles.featuredText}>{activeMatch.title}</Text>
              <View style={styles.featuredFooter}>
                <Pressable style={styles.featuredArrow} onPress={showPreviousMatch}>
                  <Ionicons name="chevron-back" size={18} color={colors.greenDark} />
                </Pressable>
                <Text style={styles.featuredCounter}>
                  {(activeMatchIndex % relevantMatches.length) + 1}/{relevantMatches.length}
                </Text>
                <Pressable style={styles.featuredArrow} onPress={showNextMatch}>
                  <Ionicons name="chevron-forward" size={18} color={colors.greenDark} />
                </Pressable>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.featuredCard, styles.featuredEmptyCard]}>
            <Text style={styles.featuredEmptyText}>Ingen aktuelle kamper akkurat nå.</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

function MatchesScreen({
  profile,
  matches,
  requests,
  onOpenMatch,
  onCreateMatch
}: {
  profile: TeamProfile;
  matches: Match[];
  requests: MatchRequest[];
  onOpenMatch: (id: string) => void;
  onCreateMatch: () => void;
}) {
  const [sportFilter, setSportFilter] = useState<Sport | "Alle">("Alle");
  const [hideAgreed, setHideAgreed] = useState(false);
  const [searchText, setSearchText] = useState("");
  const filtered = matches.filter((match) => {
    const sportMatches = sportFilter === "Alle" || match.sport === sportFilter;
    const statusMatches = !hideAgreed || match.status !== "avtalt";
    const search = searchText.trim().toLowerCase();
    const searchMatches =
      !search ||
      [match.title, match.hostClub, match.hostTeam, match.place, match.city, match.ageGroup, match.level]
        .join(" ")
        .toLowerCase()
        .includes(search);
    return sportMatches && statusMatches && searchMatches;
  });

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
            <Picker.Item label="Håndball" value="Handball" />
          </Picker>
        </View>
        <Pressable style={styles.iconButton} onPress={onCreateMatch}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <Pressable style={styles.filterToggle} onPress={() => setHideAgreed((current) => !current)}>
        <View style={[styles.checkbox, hideAgreed && styles.checkboxActive]}>
          {hideAgreed ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
        </View>
        <Text style={styles.filterToggleText}>Skjul avtalte kamper</Text>
      </Pressable>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Søk klubb, sted eller lag"
          placeholderTextColor={colors.muted}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState text="Ingen ledige kamper med disse filtrene." />}
        renderItem={({ item }) => {
          const hasMyRequest = requests.some(
            (request) => request.matchId === item.id && request.fromTeamId === profile.id
          );
          return (
            <MatchCard
              match={item}
              hasMyRequest={hasMyRequest}
              approvedRequest={requests.find((request) => request.id === item.approvedRequestId)}
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
  const sortedRequests = [...requests].sort(
    (a, b) => getRequestSortValue(a.status) - getRequestSortValue(b.status)
  );
  const pendingCount = requests.filter((request) => request.status === "venter").length;

  return (
    <FlatList
      data={sortedRequests}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.inboxSummary}>
          <Text style={styles.inboxSummaryNumber}>{pendingCount}</Text>
          <View style={styles.inboxSummaryTextWrap}>
            <Text style={styles.inboxSummaryTitle}>Ventende forespørsler</Text>
            <Text style={styles.inboxSummaryText}>
              Forespørsler på kamper du har lagt ut vises her.
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState text="Ingen forespørsler enda." />}
      renderItem={({ item }) => {
        const match = matches.find((candidate) => candidate.id === item.matchId);
        return (
          <Pressable style={styles.inboxCard} onPress={() => onOpenRequest(item.id)}>
            <View style={styles.inboxCardTop}>
              <View style={styles.requestInfo}>
                <Text style={styles.cardTitle}>{item.fromTeam}</Text>
                <Text style={styles.cardMeta}>{match?.title ?? "Kamp"}</Text>
              </View>
              <RequestBadge status={item.status} />
            </View>

            {match ? (
              <View style={styles.inboxMetaGrid}>
                <InfoLine icon="calendar-outline" text={`${match.date} ${match.time}`} />
                <InfoLine icon="location-outline" text={`${match.place}, ${match.city}`} />
              </View>
            ) : null}

            {item.message ? (
              <Text style={styles.inboxMessage}>
                {formatRequestMessage(item.message, item.fromClub, item.fromTeam)}
              </Text>
            ) : null}

            <View style={styles.inboxCardFooter}>
              <Text style={styles.inboxCardHint}>
                {item.status === "venter" ? "Trykk for å godkjenne eller avslå" : "Trykk for detaljer"}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function AgreedMatchesScreen({
  profile,
  matches,
  requests,
  onOpenMatch
}: {
  profile: TeamProfile;
  matches: Match[];
  requests: MatchRequest[];
  onOpenMatch: (id: string) => void;
}) {
  const agreedMatches = matches.filter((match) => {
    if (match.status !== "avtalt") {
      return false;
    }

    if (match.hostTeamId === profile.id) {
      return true;
    }

    const approvedRequest = requests.find((request) => request.id === match.approvedRequestId);
    return approvedRequest?.fromTeamId === profile.id && approvedRequest.status === "godkjent";
  });

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Mine kamper</Text>
        <Text style={styles.mineSectionCount}>{agreedMatches.length}</Text>
      </View>

      {agreedMatches.length === 0 ? (
        <EmptyState text="Du har ingen avtalte kamper enda." />
      ) : null}

      {agreedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          hasMyRequest={match.hostTeamId !== profile.id}
          approvedRequest={requests.find((request) => request.id === match.approvedRequestId)}
          onPress={() => onOpenMatch(match.id)}
        />
      ))}
    </ScrollView>
  );
}

function MineScreen({
  profile,
  hostedMatches,
  myRequests,
  incomingRequests,
  requests,
  matches,
  userEmail,
  onEditProfile,
  onSignOut,
  onOpenMatch,
  onOpenRequest
}: {
  profile: TeamProfile;
  hostedMatches: Match[];
  myRequests: MatchRequest[];
  incomingRequests: MatchRequest[];
  requests: MatchRequest[];
  matches: Match[];
  userEmail: string | null;
  onEditProfile: () => void;
  onSignOut: () => void;
  onOpenMatch: (id: string) => void;
  onOpenRequest: (id: string) => void;
}) {
  const openHostedMatches = hostedMatches.filter((match) => match.status !== "avtalt");
  const incomingOpenRequests = incomingRequests.filter((request) => request.status !== "godkjent");
  const sentOpenRequests = [...myRequests]
    .filter((request) => request.status !== "godkjent")
    .sort((a, b) => getRequestSortValue(a.status) - getRequestSortValue(b.status));

  const totalOpenItems = openHostedMatches.length + incomingOpenRequests.length + sentOpenRequests.length;
  const pendingIncoming = incomingOpenRequests.filter((request) => request.status === "venter").length;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.accountBox}>
        <Text style={styles.sectionLabel}>Innlogget konto</Text>
        <Text style={styles.accountEmail}>{userEmail ?? "Ukjent bruker"}</Text>
        <Text style={styles.accountProfileText}>
          {profile.contactName} · {formatSport(profile.sport)} · {profile.team} · {profile.ageGroup}
        </Text>
        <View style={styles.accountActions}>
          <Pressable style={styles.editProfileButton} onPress={onEditProfile}>
            <Ionicons name="create-outline" size={17} color={colors.greenDark} />
            <Text style={styles.signOutText}>Rediger lagprofil</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={onSignOut}>
            <Text style={styles.signOutText}>Logg ut</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mineStats}>
        <View style={styles.mineStatItem}>
          <Text style={styles.mineStatNumber}>{totalOpenItems}</Text>
          <Text style={styles.mineStatLabel}>Aktive</Text>
        </View>
        <View style={styles.mineStatItem}>
          <Text style={styles.mineStatNumber}>{pendingIncoming}</Text>
          <Text style={styles.mineStatLabel}>Nye</Text>
        </View>
        <View style={styles.mineStatItem}>
          <Text style={styles.mineStatNumber}>{sentOpenRequests.length}</Text>
          <Text style={styles.mineStatLabel}>Sendt</Text>
        </View>
      </View>

      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Kamper jeg har lagt ut</Text>
        <Text style={styles.mineSectionCount}>{openHostedMatches.length}</Text>
      </View>
      {openHostedMatches.length === 0 ? <EmptyState text="Du har ingen åpne kamper ute." /> : null}
      {openHostedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          hasMyRequest={false}
          approvedRequest={requests.find((request) => request.id === match.approvedRequestId)}
          onPress={() => onOpenMatch(match.id)}
        />
      ))}

      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Forespørsler på mine kamper</Text>
        <Text style={styles.mineSectionCount}>{incomingOpenRequests.length}</Text>
      </View>
      {incomingOpenRequests.length === 0 ? <EmptyState text="Ingen nye forespørsler på dine kamper." /> : null}
      {incomingOpenRequests.map((request) => {
        const match = matches.find((candidate) => candidate.id === request.matchId);
        if (!match) {
          return null;
        }

        return (
          <Pressable key={request.id} style={styles.requestCard} onPress={() => onOpenRequest(request.id)}>
            <View style={styles.requestInfo}>
              <Text style={styles.cardTitle}>{match.title}</Text>
              <Text style={styles.cardMeta}>
                {formatTeamName(request.fromClub, request.fromTeam)} · {match.date}
              </Text>
            </View>
            <RequestBadge status={request.status} />
          </Pressable>
        );
      })}

      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Mine forespørsler</Text>
        <Text style={styles.mineSectionCount}>{sentOpenRequests.length}</Text>
      </View>
      {sentOpenRequests.length === 0 ? <EmptyState text="Du har ingen aktive forespørsler." /> : null}
      {sentOpenRequests.map((request) => {
        const match = matches.find((candidate) => candidate.id === request.matchId);
        if (!match) {
          return null;
        }
        return (
          <Pressable key={request.id} style={styles.requestCard} onPress={() => onOpenRequest(request.id)}>
            <View style={styles.requestInfo}>
              <Text style={styles.cardTitle}>{match.title}</Text>
              <Text style={styles.cardMeta}>{formatTeamName(match.hostClub, match.hostTeam)} · {match.date}</Text>
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
  approvedRequest,
  onPress
}: {
  match: Match;
  hasMyRequest: boolean;
  approvedRequest?: MatchRequest;
  onPress: () => void;
}) {
  const statusStyle = getMatchStatusStyle(match.status);
  const cardTitle = getMatchDisplayTitle(match, approvedRequest);

  return (
    <Pressable style={[styles.matchCard, { borderColor: statusStyle.border }]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{cardTitle}</Text>
          <Text style={styles.cardMeta}>{formatSport(match.sport)} · {match.ageGroup} · {match.level}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{match.status}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <InfoLine icon="calendar-outline" text={`${match.date} ${match.time}`} />
        <InfoLine icon="location-outline" text={`${match.place}, ${match.city}`} />
      </View>

      {hasMyRequest ? <Text style={styles.requestHint}>Du har sendt forespørsel</Text> : null}
    </Pressable>
  );
}

function CreateMatchModal({
  visible,
  profile,
  form,
  feedback,
  isPublishing,
  onChange,
  onClose,
  onSubmit
}: {
  visible: boolean;
  profile: TeamProfile;
  form: ReturnType<typeof createEmptyForm>;
  feedback: string | null;
  isPublishing: boolean;
  onChange: (form: ReturnType<typeof createEmptyForm>) => void;
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
            <ReadonlyField label="Lag" value={profile.team} />
            <ReadonlyField label="Kontaktperson" value={profile.contactName} />

            <Text style={styles.inputLabel}>Idrett</Text>
            <View style={styles.pickerField}>
              <Picker
                selectedValue={form.sport}
                onValueChange={(sport: Sport) => onChange({ ...form, sport })}
              >
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Håndball" value="Handball" />
              </Picker>
            </View>

            <Input label="Tittel" value={form.title} onChangeText={(title) => onChange({ ...form, title })} placeholder="Eks: FC Oslo G13 søker kamp" />
            <Input label="Alder" value={form.ageGroup} onChangeText={(ageGroup) => onChange({ ...form, ageGroup })} placeholder="Eks: G13/J13" />
            <Input label="Nivå" value={form.level} onChangeText={(level) => onChange({ ...form, level })} placeholder="Eks: Nivå 1, 2 eller 3" />
            <Input label="Dato" value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="Eks: 15.06.2026" />
            <Input label="Tid" value={form.time} onChangeText={(time) => onChange({ ...form, time })} placeholder="Eks: 18:00" />
            <Input label="Sted" value={form.place} onChangeText={(place) => onChange({ ...form, place })} placeholder="Eks: Bisset Stadion" />
            <Input label="By/område" value={form.city} onChangeText={(city) => onChange({ ...form, city })} placeholder="Eks: Oslo" />
            <Input label="Type" value={form.matchType} onChangeText={(matchType) => onChange({ ...form, matchType })} placeholder="Eks: Treningskamp" />
            <Input
              label="Kommentar"
              value={form.comment}
              onChangeText={(comment) => onChange({ ...form, comment })}
              placeholder="Eks: Ønsker jevn motstand"
              multiline
            />

            {feedback ? <Text style={styles.formFeedback}>{feedback}</Text> : null}

            <Pressable
              style={[styles.primaryButtonFull, isPublishing && styles.disabledButton]}
              disabled={isPublishing}
              onPress={onSubmit}
            >
              <Text style={styles.primaryButtonText}>
                {isPublishing ? "Publiserer..." : "Publiser kamp"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function EditMatchModal({
  match,
  form,
  feedback,
  isSaving,
  onChange,
  onClose,
  onSubmit
}: {
  match: Match | null;
  form: ReturnType<typeof createEmptyForm>;
  feedback: string | null;
  isSaving: boolean;
  onChange: (form: ReturnType<typeof createEmptyForm>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!match) {
    return null;
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKeyboard}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rediger kamp</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <Input label="Tittel" value={form.title} onChangeText={(title) => onChange({ ...form, title })} placeholder="Eks: FC Oslo G13 søker kamp" />

            <Text style={styles.inputLabel}>Idrett</Text>
            <View style={styles.pickerField}>
              <Picker
                selectedValue={form.sport}
                onValueChange={(sport: Sport) => onChange({ ...form, sport })}
              >
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Håndball" value="Handball" />
              </Picker>
            </View>

            <Input label="Alder" value={form.ageGroup} onChangeText={(ageGroup) => onChange({ ...form, ageGroup })} placeholder="Eks: G13/J13" />
            <Input label="Nivå" value={form.level} onChangeText={(level) => onChange({ ...form, level })} placeholder="Eks: Nivå 1, 2 eller 3" />
            <Input label="Dato" value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="Eks: 15.06.2026" />
            <Input label="Tid" value={form.time} onChangeText={(time) => onChange({ ...form, time })} placeholder="Eks: 18:00" />
            <Input label="Sted" value={form.place} onChangeText={(place) => onChange({ ...form, place })} placeholder="Eks: Bisset Stadion" />
            <Input label="By/område" value={form.city} onChangeText={(city) => onChange({ ...form, city })} placeholder="Eks: Oslo" />
            <Input label="Type" value={form.matchType} onChangeText={(matchType) => onChange({ ...form, matchType })} placeholder="Eks: Treningskamp" />
            <Input
              label="Kommentar"
              value={form.comment}
              onChangeText={(comment) => onChange({ ...form, comment })}
              placeholder="Eks: Ønsker jevn motstand"
              multiline
            />

            {feedback ? <Text style={styles.formFeedback}>{feedback}</Text> : null}

            <Pressable
              style={[styles.primaryButtonFull, isSaving && styles.disabledButton]}
              disabled={isSaving}
              onPress={onSubmit}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? "Lagrer..." : "Lagre endringer"}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MatchDetailsModal({
  match,
  profile,
  requests,
  isSendingRequest,
  onClose,
  onSendRequest,
  onEditMatch,
  onDeleteMatch
}: {
  match: Match | null;
  profile: TeamProfile;
  requests: MatchRequest[];
  isSendingRequest: boolean;
  onClose: () => void;
  onSendRequest: (match: Match) => void;
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (match: Match) => void;
}) {
  if (!match) {
    return null;
  }

  const myRequest = requests.find(
    (request) => request.matchId === match.id && request.fromTeamId === profile.id
  );
  const isOwnMatch = match.hostTeamId === profile.id;
  const requestButtonDisabled =
    isSendingRequest || match.status === "avtalt" || Boolean(myRequest && myRequest.status !== "avslatt");

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
          <DetailRow label="Idrett" value={formatSport(match.sport)} />
          <DetailRow label="Alder" value={match.ageGroup} />
          <DetailRow label="Nivå" value={match.level} />
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
                requestButtonDisabled && styles.disabledButton
              ]}
              disabled={requestButtonDisabled}
              onPress={() => onSendRequest(match)}
            >
              <Text style={styles.primaryButtonText}>
                {isSendingRequest
                  ? "Sender..."
                  : myRequest && myRequest.status !== "avslatt"
                    ? "Forespørsel sendt"
                    : "Send forespørsel"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.actionStack}>
              <Text style={styles.requestHint}>Dette er en kamp du har lagt ut.</Text>

              <Pressable
                style={styles.primaryButtonFull}
                onPress={() => onEditMatch(match)}
              >
                <Text style={styles.primaryButtonText}>Rediger kamp</Text>
              </Pressable>

              <Pressable
                style={styles.dangerButton}
                onPress={() => onDeleteMatch(match)}
              >
                <Text style={styles.dangerButtonText}>Slett kamp</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function RequestDetailsModal({
  request,
  profile,
  match,
  messages,
  messageText,
  chatFeedback,
  isSendingMessage,
  onMessageTextChange,
  onSendChatMessage,
  onApprove,
  onDecline,
  onWithdraw,
  onClose
}: {
  request: MatchRequest | null;
  profile: TeamProfile;
  match: Match | null;
  messages: ChatMessage[];
  messageText: string;
  chatFeedback: string | null;
  isSendingMessage: boolean;
  onMessageTextChange: (text: string) => void;
  onSendChatMessage: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  if (!request || !match) {
    return null;
  }

  const isIncoming = match.hostTeamId === profile.id;
  const canWithdraw = request.fromTeamId === profile.id && request.status !== "avslatt";

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Forespørsel</Text>
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
            <Text style={styles.cardMeta}>{formatTeamName(request.fromClub, request.fromTeam)}</Text>
            <RequestBadge status={request.status} />

            <Text style={styles.sectionTitle}>Status</Text>
            <Text style={styles.paragraph}>{getRequestText(request.status)}</Text>

            {isIncoming ? (
              <View style={styles.actionStack}>
                <Pressable style={styles.primaryButtonFull} onPress={onApprove}>
                  <Text style={styles.primaryButtonText}>Godkjenn</Text>
                </Pressable>
                <Pressable style={styles.dangerButton} onPress={onDecline}>
                  <Text style={styles.dangerButtonText}>Avslå</Text>
                </Pressable>
              </View>
            ) : null}

            {canWithdraw ? (
              <Pressable style={styles.dangerButton} onPress={onWithdraw}>
                <Text style={styles.dangerButtonText}>Trekk forespørsel</Text>
              </Pressable>
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
              <Pressable
                disabled={isSendingMessage || !messageText.trim()}
                style={[
                  styles.sendButton,
                  (isSendingMessage || !messageText.trim()) && styles.disabledButton
                ]}
                onPress={onSendChatMessage}
              >
                {isSendingMessage ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
            {chatFeedback ? <Text style={styles.chatFeedback}>{chatFeedback}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function BottomTabs({
  activeTab,
  onChange,
  badges = {}
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  badges?: TabBadges;
}) {
  const tabs: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: "home", label: "Hjem", icon: "home-outline" },
    { key: "matches", label: "Kamper", icon: "paper-plane-outline" },
    { key: "inbox", label: "Mine kamper", icon: "calendar-outline" },
    { key: "mine", label: "Forespørsler", icon: "file-tray-outline" }
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        const badgeCount = badges[tab.key] ?? 0;
        return (
          <Pressable key={tab.key} style={styles.tabButton} onPress={() => onChange(tab.key)}>
            <View style={styles.tabIconWrap}>
              <Ionicons name={tab.icon} size={23} color={active ? colors.greenDark : colors.muted} />
              {badgeCount > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
                </View>
              ) : null}
            </View>
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
    return "";
  }
  if (tab === "matches") {
    return "Kamper";
  }
  if (tab === "inbox") {
    return "Mine kamper";
  }
  return "Forespørsler";
}

function formatTeamName(club: string, team: string) {
  const cleanClub = club.trim();
  const cleanTeam = team.trim();

  return cleanTeam || cleanClub;
}

function getMatchDisplayTitle(match: Match, approvedRequest?: MatchRequest) {
  const hostName = formatTeamName(match.hostClub, match.hostTeam);

  if (match.status !== "avtalt" || !approvedRequest) {
    return hostName;
  }

  const opponentName = formatTeamName(approvedRequest.fromClub, approvedRequest.fromTeam);
  return `${hostName} - ${opponentName}`;
}

function replaceRequest(requests: MatchRequest[], temporaryId: string, savedRequest: MatchRequest) {
  const withoutDuplicate = requests.filter(
    (request) => request.id !== savedRequest.id || request.id === temporaryId
  );

  return withoutDuplicate.map((request) => (request.id === temporaryId ? savedRequest : request));
}

function formatRequestMessage(message: string, club: string, team: string) {
  const cleanMessage = message.trim();
  const cleanClub = club.trim();
  const cleanTeam = team.trim();

  if (!cleanClub || !cleanTeam) {
    return cleanMessage;
  }

  const duplicatedName = `${cleanClub} ${cleanTeam}`;
  if (cleanClub.toLowerCase() === cleanTeam.toLowerCase()) {
    return cleanMessage.replace(new RegExp(`^${escapeRegExp(duplicatedName)}\\b`, "i"), cleanTeam);
  }

  return cleanMessage;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapDatabaseMatch(row: DatabaseMatchRow): Match {
  const date = new Date(`${row.match_date}T00:00:00`);
  const formattedDate = Number.isNaN(date.getTime())
    ? row.match_date
    : date.toLocaleDateString("no-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });

  return {
    id: row.id,
    title: row.title,
    sport: row.sport,
    hostTeamId: row.host_team_id,
    hostClub: row.teams?.club ?? "Ukjent klubb",
    hostTeam: row.teams?.team ?? "Ukjent lag",
    ageGroup: row.age_group,
    level: row.level,
    date: formattedDate,
    time: row.match_time ? row.match_time.slice(0, 5) : "Ikke satt",
    place: row.place,
    city: row.city,
    matchType: row.match_type,
    comment: row.comment ?? "",
    contactName: row.teams?.contact_name ?? "Ukjent kontakt",
    status: row.status,
    approvedRequestId: row.approved_request_id ?? undefined
  };
}

function mapDatabaseRequest(row: DatabaseRequestRow): MatchRequest {
  return {
    id: row.id,
    matchId: row.match_id,
    fromTeamId: row.from_team_id,
    fromClub: row.teams?.club ?? "Ukjent klubb",
    fromTeam: row.teams?.team ?? "Ukjent lag",
    message: row.message ?? "",
    status: row.status,
    createdAt: formatRelativeDate(row.created_at)
  };
}

function mapDatabaseChatMessage(row: DatabaseChatMessageRow): ChatMessage {
  return {
    id: row.id,
    requestId: row.request_id,
    sender: row.users?.full_name ?? "Trener",
    text: row.text,
    createdAt: formatRelativeDate(row.created_at)
  };
}

function mapDatabaseTeam(row: DatabaseTeamRow): TeamProfile {
  return {
    id: row.id,
    sport: row.sport,
    club: row.club,
    team: row.team,
    ageGroup: row.age_group,
    level: row.level,
    contactName: row.contact_name,
    phone: row.users?.phone ?? "",
    email: row.users?.email ?? ""
  };
}

function formatSport(sport: Sport) {
  return sport === "Handball" ? "Håndball" : sport;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Nylig";
  }

  return date.toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function parseDateForDatabase(value: string) {
  const trimmed = value.trim();
  const norwegianDate = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (norwegianDate) {
    const [, day, month, year] = norwegianDate;
    return createValidDatabaseDate(year, month, day);
  }

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return createValidDatabaseDate(year, month, day);
  }

  return null;
}

function createValidDatabaseDate(year: string, month: string, day: string) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);
  const normalizedDay = Number(day);
  const date = new Date(normalizedYear, normalizedMonth - 1, normalizedDay);

  if (
    date.getFullYear() !== normalizedYear ||
    date.getMonth() !== normalizedMonth - 1 ||
    date.getDate() !== normalizedDay
  ) {
    return null;
  }

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isPastDatabaseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function formatDatabaseDateForDisplay(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function parseTimeForDatabase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const time = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!time) {
    return null;
  }

  const [, hours, minutes] = time;
  const normalizedHours = Number(hours);
  const normalizedMinutes = Number(minutes);

  if (normalizedHours > 23 || normalizedMinutes > 59) {
    return null;
  }

  return `${hours.padStart(2, "0")}:${minutes}:00`;
}

function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `20000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, "0")}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
    return "Avslått";
  }
  return "Ledig";
}

function getErrorMessage(error: unknown) {
  return getReadableErrorMessage(error, "Meldingen ble ikke lagret.");
}

function getReadableErrorMessage(error: unknown, fallback = "Noe gikk galt. Prøv igjen.") {
  const rawMessage = getRawErrorMessage(error);
  const lowerMessage = rawMessage.toLowerCase();

  if (lowerMessage.includes("invalid login credentials")) {
    return "E-post eller passord er feil.";
  }

  if (lowerMessage.includes("email not confirmed")) {
    return "E-posten må bekreftes før du kan logge inn.";
  }

  if (lowerMessage.includes("already registered") || lowerMessage.includes("user already registered")) {
    return "Denne e-posten er allerede registrert. Prøv å logge inn.";
  }

  if (lowerMessage.includes("password")) {
    return "Passordet må være minst 6 tegn.";
  }

  if (lowerMessage.includes("row-level security") || lowerMessage.includes("violates row-level security")) {
    return "Du har ikke tilgang til å lagre dette ennå. Sjekk at du er innlogget og prøv igjen.";
  }

  if (lowerMessage.includes("duplicate key") || lowerMessage.includes("already exists")) {
    return "Dette finnes allerede.";
  }

  if (lowerMessage.includes("network") || lowerMessage.includes("failed to fetch")) {
    return "Appen fikk ikke kontakt med serveren. Prøv igjen.";
  }

  return rawMessage || fallback;
}

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "";
}

function getRequestSortValue(status: RequestStatus) {
  if (status === "venter") {
    return 0;
  }
  if (status === "godkjent") {
    return 1;
  }
  return 2;
}

function getRequestText(status: RequestStatus) {
  if (status === "godkjent") {
    return "Denne forespørselen er godkjent, og kampen er avtalt.";
  }
  if (status === "avslatt") {
    return "Denne forespørselen er avslått for deg. Kampen kan fortsatt være ledig for andre trenere.";
  }
  return "Forespørselen venter på svar. Kampen vises fortsatt som ledig i markedet.";
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
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: 14,
    justifyContent: "center"
  },
  loadingText: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: "800"
  },
  authScreen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 28
  },
  authTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center"
  },
  authText: {
    color: colors.greenDark,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
    textAlign: "center"
  },
  authForm: {
    gap: 14,
    marginTop: 28
  },
  profileSetupContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 28
  },
  authModeButton: {
    alignItems: "center",
    paddingVertical: 12
  },
  authModeText: {
    color: colors.greenDark,
    fontSize: 15,
    fontWeight: "900"
  },
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: 22,
    minHeight: 92,
    justifyContent: "center",
    paddingBottom: 0,
    paddingTop: 0
  },
  headerTitle: {
    color: colors.black,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center"
  },
  headerProfileText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    position: "absolute",
    top: 10,
    left: 22,
    right: 22,
    textAlign: "center"
  },
  content: {
    flex: 1
  },
  home: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 20,
    justifyContent: "flex-start"
  },
  logoMarkWrap: {
    alignItems: "center",
    marginBottom: 22
  },
  logoMarkWrapCompact: {
    marginBottom: 0,
    marginTop: 10
  },
  logoIcon: {
    height: 34,
    marginBottom: 5,
    position: "relative",
    width: 92
  },
  logoIconCompact: {
    height: 18,
    marginBottom: 0,
    width: 52
  },
  logoDot: {
    backgroundColor: colors.black,
    borderRadius: 999,
    height: 11,
    position: "absolute",
    top: 12,
    width: 11,
    zIndex: 2
  },
  logoDotCompact: {
    height: 7,
    top: 6,
    width: 7
  },
  logoDotLeft: {
    left: 18
  },
  logoDotRight: {
    right: 18
  },
  logoArc: {
    borderColor: colors.green,
    borderRadius: 999,
    borderWidth: 4,
    height: 30,
    left: 22,
    position: "absolute",
    width: 48
  },
  logoArcCompact: {
    borderWidth: 3,
    height: 17,
    left: 12,
    width: 28
  },
  logoArcTop: {
    borderBottomColor: "transparent",
    top: 0
  },
  logoArcBottom: {
    borderTopColor: "transparent",
    bottom: 0
  },
  logo: {
    color: colors.black,
    fontSize: 44,
    fontWeight: "800",
    textAlign: "center"
  },
  logoCompact: {
    fontSize: 24
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 29,
    marginBottom: 18,
    textAlign: "center"
  },
  heroText: {
    color: colors.greenDark,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 0,
    textAlign: "center"
  },
  heroTextSecond: {
    marginTop: 12
  },
  homeActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 34
  },
  featuredArea: {
    marginTop: 96
  },
  featuredAreaWithNotification: {
    marginTop: 44
  },
  featuredTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 32,
    textAlign: "center"
  },
  featuredCard: {
    backgroundColor: colors.card,
    borderColor: colors.greenLight,
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 104
  },
  featuredEmptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  featuredCardButton: {
    padding: 12
  },
  featuredTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  featuredClub: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900"
  },
  featuredBadge: {
    backgroundColor: colors.greenLight,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  featuredBadgeText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "900"
  },
  featuredMeta: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 7
  },
  featuredText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 5
  },
  featuredEmptyText: {
    color: colors.black,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    textAlign: "center"
  },
  featuredFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 7
  },
  featuredCounter: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "900"
  },
  featuredArrow: {
    alignItems: "center",
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 34
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
  notificationPanel: {
    alignSelf: "center",
    backgroundColor: colors.black,
    borderColor: colors.greenDark,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    marginTop: 44,
    maxWidth: 285,
    paddingHorizontal: 9,
    paddingVertical: 6,
    width: "78%"
  },
  notificationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  notificationText: {
    color: colors.green,
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14
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
  filterToggle: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 9,
    marginHorizontal: 16,
    marginBottom: 4,
    marginTop: -4,
    paddingVertical: 8
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  checkboxActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  filterToggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 46
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
  inboxSummary: {
    alignItems: "center",
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16
  },
  inboxSummaryNumber: {
    backgroundColor: colors.green,
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    minWidth: 48,
    overflow: "hidden",
    paddingVertical: 9,
    textAlign: "center"
  },
  inboxSummaryTextWrap: {
    flex: 1
  },
  inboxSummaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  inboxSummaryText: {
    color: colors.greenDark,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3
  },
  inboxCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  inboxCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  inboxMetaGrid: {
    gap: 7
  },
  inboxMessage: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    padding: 12
  },
  inboxCardFooter: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12
  },
  inboxCardHint: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: "800"
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
  accountBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  accountEmail: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6
  },
  accountProfileText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14
  },
  accountActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  mineStats: {
    flexDirection: "row",
    gap: 10
  },
  mineStatItem: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14
  },
  mineStatNumber: {
    color: colors.greenDark,
    fontSize: 22,
    fontWeight: "900"
  },
  mineStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3
  },
  mineSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4
  },
  mineSectionCount: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: "900",
    minWidth: 34,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: "center"
  },
  signOutButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  editProfileButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14
  },
  signOutText: {
    color: colors.greenDark,
    fontSize: 14,
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
  formFeedback: {
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.red,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    padding: 12
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
  chatFeedback: {
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.red,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    padding: 12
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
  tabIconWrap: {
    height: 25,
    position: "relative",
    width: 31,
    alignItems: "center",
    justifyContent: "center"
  },
  tabBadge: {
    alignItems: "center",
    backgroundColor: colors.red,
    borderColor: colors.card,
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: -3,
    top: -5
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12
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

