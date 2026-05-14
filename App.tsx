import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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

const readSeenNotificationCounts = (profileId: string) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const saved = window.localStorage.getItem(`playr-seen-notification-counts-${profileId}`);
    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved);
    return {
      incoming: Number(parsed.incoming) || 0,
      approved: Number(parsed.approved) || 0
    };
  } catch {
    return null;
  }
};

const saveSeenNotificationCounts = (profileId: string, incoming: number, approved: number) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    `playr-seen-notification-counts-${profileId}`,
    JSON.stringify({ incoming, approved })
  );
};

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

const getLevelNumber = (value: string) => {
  const level = value.match(/[1-3]/g)?.at(-1) ?? "";
  return level;
};

const formatLevel = (value: string) => `Nivå ${getLevelNumber(value)}`;

const getAgeGroupPrefix = (value: string) => {
  const prefix = value.trim().charAt(0).toUpperCase();
  return prefix === "G" || prefix === "J" ? prefix : "";
};

const getAgeGroupNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(0, 4) : "";
};

const getAgeGroupInputNumber = (value: string) => value.replace(/\D/g, "").slice(0, 4);

const getAgeGroupDisplay = (value: string) => {
  const prefix = getAgeGroupPrefix(value);
  const digits = value.replace(/\D/g, "");
  const birthYear = digits.length >= 4 ? Number(digits.slice(0, 4)) : null;

  if (!prefix) {
    return value;
  }

  if (birthYear) {
    const age = new Date().getFullYear() - birthYear;
    return age > 0 ? `${prefix}${age}` : value;
  }

  return digits ? `${prefix}${digits}` : value;
};

const formatAgeGroup = (value: string) => `${getAgeGroupPrefix(value)}${getAgeGroupNumber(value)}`;

const getAgeGroupFormValue = (value: string) => {
  const prefix = getAgeGroupPrefix(value);
  const digits = value.replace(/\D/g, "");

  if (!prefix || !digits) {
    return "";
  }

  if (digits.length >= 4) {
    return `${prefix}${digits.slice(0, 4)}`;
  }

  const birthYear = new Date().getFullYear() - Number(digits);
  return birthYear > 0 ? `${prefix}${birthYear}` : "";
};

export default function App() {
  const legalPage = getLegalPageFromPath();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [matches, setMatches] = useState<Match[]>(isSupabaseConfigured ? [] : initialMatches);
  const [requests, setRequests] = useState<MatchRequest[]>(isSupabaseConfigured ? [] : initialRequests);
  const [messages, setMessages] = useState<ChatMessage[]>(isSupabaseConfigured ? [] : initialMessages);
  const [currentProfile, setCurrentProfile] = useState<TeamProfile>(fallbackProfile);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>(isSupabaseConfigured ? [] : [fallbackProfile]);
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
  const [isDeletingMatch, setIsDeletingMatch] = useState(false);
  const [isCancelingMatch, setIsCancelingMatch] = useState(false);
  const [editForm, setEditForm] = useState(createEmptyForm(fallbackProfile));
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [seenIncomingCount, setSeenIncomingCount] = useState(0);
  const [seenApprovedCount, setSeenApprovedCount] = useState(0);

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;
  const editingMatch = matches.find((match) => match.id === editMatchId) ?? null;

  const myTeamIds = useMemo(
    () => new Set(teamProfiles.map((profile) => profile.id)),
    [teamProfiles]
  );

  const myHostedMatches = useMemo(
    () => matches.filter((match) => isMatchOwnedByProfiles(match, teamProfiles)),
    [matches, teamProfiles]
  );

  const myRequests = useMemo(
    () => requests.filter((request) => myTeamIds.has(request.fromTeamId)),
    [requests, myTeamIds]
  );

  const selectedMatchProfile =
    selectedMatch && isMatchOwnedByProfiles(selectedMatch, teamProfiles)
      ? getProfileForMatch(selectedMatch, teamProfiles) ?? currentProfile
      : currentProfile;
  const selectedRequestMatch = selectedRequest
    ? matches.find((match) => match.id === selectedRequest.matchId) ?? null
    : null;
  const selectedRequestProfile =
    selectedRequest && selectedRequestMatch
      ? getProfileForMatch(selectedRequestMatch, teamProfiles) ??
        teamProfiles.find((profile) => profile.id === selectedRequest.fromTeamId) ??
        currentProfile
      : currentProfile;

  const incomingRequests = useMemo(() => {
    const hostedIds = new Set(myHostedMatches.map((match) => match.id));
    return requests.filter((request) => hostedIds.has(request.matchId));
  }, [myHostedMatches, requests]);

  const pendingIncomingCount = useMemo(
    () => incomingRequests.filter((request) => request.status === "venter").length,
    [incomingRequests]
  );

  const approvedMyRequestsCount = useMemo(
    () => myRequests.filter((request) => request.status === "godkjent").length,
    [myRequests]
  );

  const visibleIncomingNotificationCount = Math.max(pendingIncomingCount - seenIncomingCount, 0);
  const visibleApprovedNotificationCount = Math.max(approvedMyRequestsCount - seenApprovedCount, 0);
  const openCreateMatch = () => {
    setForm({ ...createEmptyForm(currentProfile), ageGroup: getAgeGroupFormValue(currentProfile.ageGroup) });
    setCreateFeedback(null);
    setCreateVisible(true);
  };
  const selectTeamProfile = (profile: TeamProfile) => {
    setCurrentProfile(profile);
    setForm(createEmptyForm(profile));
    setSeenIncomingCount(0);
    setSeenApprovedCount(0);
  };

  useEffect(() => {
    if (!appDataReady || !currentProfile.id || typeof window === "undefined") {
      return;
    }

    const shouldClear = new URLSearchParams(window.location.search).get("clearNotifications") === "1";
    const saved = shouldClear ? null : readSeenNotificationCounts(currentProfile.id);
    const nextIncoming = saved ? Math.min(saved.incoming, pendingIncomingCount) : pendingIncomingCount;
    const nextApproved = saved ? Math.min(saved.approved, approvedMyRequestsCount) : approvedMyRequestsCount;

    setSeenIncomingCount(nextIncoming);
    setSeenApprovedCount(nextApproved);
    saveSeenNotificationCounts(currentProfile.id, nextIncoming, nextApproved);
  }, [appDataReady, currentProfile.id, pendingIncomingCount, approvedMyRequestsCount]);

  useEffect(() => {
    if (!appDataReady || !currentProfile.id) {
      return;
    }

    if (activeTab === "mine" && seenIncomingCount !== pendingIncomingCount) {
      setSeenIncomingCount(pendingIncomingCount);
      saveSeenNotificationCounts(currentProfile.id, pendingIncomingCount, seenApprovedCount);
    }

    if (activeTab === "inbox" && seenApprovedCount !== approvedMyRequestsCount) {
      setSeenApprovedCount(approvedMyRequestsCount);
      saveSeenNotificationCounts(currentProfile.id, seenIncomingCount, approvedMyRequestsCount);
    }
  }, [
    activeTab,
    appDataReady,
    currentProfile.id,
    pendingIncomingCount,
    approvedMyRequestsCount,
    seenIncomingCount,
    seenApprovedCount
  ]);

  useEffect(() => {
    if (!currentProfile.id) {
      return;
    }

    const nextIncoming = Math.min(seenIncomingCount, pendingIncomingCount);
    const nextApproved = Math.min(seenApprovedCount, approvedMyRequestsCount);

    if (nextIncoming !== seenIncomingCount) {
      setSeenIncomingCount(nextIncoming);
    }

    if (nextApproved !== seenApprovedCount) {
      setSeenApprovedCount(nextApproved);
    }

    if (nextIncoming !== seenIncomingCount || nextApproved !== seenApprovedCount) {
      saveSeenNotificationCounts(currentProfile.id, nextIncoming, nextApproved);
    }
  }, [currentProfile.id, pendingIncomingCount, approvedMyRequestsCount, seenIncomingCount, seenApprovedCount]);

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
      setTeamProfiles([]);
      setAuthReady(true);
      setSeenIncomingCount(0);
      setSeenApprovedCount(0);
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
        .order("created_at", { ascending: true });

      if (ignore) {
        return;
      }

      if (error) {
        setProfileReady(true);
        return;
      }

      const profiles = ((data ?? []) as DatabaseTeamRow[]).map(mapDatabaseTeam);

      if (profiles.length > 0) {
        const nextProfile = profiles.find((profile) => profile.id === currentProfile.id) ?? profiles[0];
        setTeamProfiles(profiles);
        setCurrentProfile(nextProfile);
        setForm(createEmptyForm(nextProfile));
        setHasTeamProfile(true);
      } else {
        setTeamProfiles([]);
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
      title: `${getAgeGroupDisplay(formatAgeGroup(form.ageGroup)) || getAgeGroupDisplay(currentProfile.ageGroup)} søker treningskamp`,
      ageGroup: formatAgeGroup(form.ageGroup),
      level: formatLevel(form.level),
      date: form.date.trim(),
      time: form.time.trim(),
      place: form.place.trim(),
      city: form.city.trim() || "Ikke satt",
      matchType: form.matchType.trim() || "Treningskamp",
      comment: form.comment.trim()
    };

    if (
      !getAgeGroupPrefix(form.ageGroup) ||
      !getAgeGroupNumber(form.ageGroup) ||
      !getLevelNumber(form.level) ||
      !cleanForm.date ||
      !cleanForm.time ||
      !cleanForm.place
    ) {
      setCreateFeedback("Fyll inn årskull, nivå, dato, tid og bane/sted før du publiserer kampen.");
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
    if (!myTeamIds.has(match.hostTeamId)) {
      return;
    }

    setEditForm(createFormFromMatch(match));
    setEditFeedback(null);
    setEditMatchId(match.id);
    setTimeout(() => setSelectedMatchId(null), 0);
  };

  const updateMatch = async () => {
    if (!editingMatch || isUpdatingMatch) {
      return;
    }

    setEditFeedback(null);

    const cleanForm = {
      sport: editForm.sport,
      title: `${getAgeGroupDisplay(formatAgeGroup(editForm.ageGroup)) || getAgeGroupDisplay(editingMatch.ageGroup)} søker treningskamp`,
      ageGroup: formatAgeGroup(editForm.ageGroup),
      level: formatLevel(editForm.level),
      date: editForm.date.trim(),
      time: editForm.time.trim(),
      place: editForm.place.trim(),
      city: editForm.city.trim() || "Ikke satt",
      matchType: editForm.matchType.trim() || "Treningskamp",
      comment: editForm.comment.trim()
    };

    if (
      !getAgeGroupPrefix(editForm.ageGroup) ||
      !getAgeGroupNumber(editForm.ageGroup) ||
      !getLevelNumber(editForm.level) ||
      !cleanForm.date ||
      !cleanForm.time ||
      !cleanForm.place
    ) {
      setEditFeedback("Fyll inn årskull, nivå, dato, tid og bane/sted før du lagrer.");
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
          .eq("host_team_id", editingMatch.hostTeamId)
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

  const deleteMatch = (match: Match) => {
    if (isDeletingMatch) {
      return;
    }

    if (!myTeamIds.has(match.hostTeamId)) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Du kan bare slette kamper du selv har lagt ut.");
      } else {
        Alert.alert("Kan ikke slette", "Du kan bare slette kamper du selv har lagt ut.");
      }
      return;
    }

    deleteMatchNow(match);
  };

  const deleteMatchNow = async (match: Match) => {
    const previousMatches = matches;
    const previousRequests = requests;
    const previousMessages = messages;
    const requestIds = new Set(requests.filter((request) => request.matchId === match.id).map((request) => request.id));

    setIsDeletingMatch(true);
    setSelectedMatchId(null);
    setMatches((current) => current.filter((item) => item.id !== match.id));
    setRequests((current) => current.filter((request) => request.matchId !== match.id));
    setMessages((current) => current.filter((message) => !requestIds.has(message.requestId)));

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from("matches")
          .update({ status: "ledig", approved_request_id: null })
          .eq("id", match.id)
          .eq("host_team_id", match.hostTeamId);

        const { error } = await supabase
          .from("matches")
          .delete()
          .eq("id", match.id)
          .eq("host_team_id", match.hostTeamId);

        if (error) {
          setMatches(previousMatches);
          setRequests(previousRequests);
          setMessages(previousMessages);
          Alert.alert("Kampen ble ikke slettet", getReadableErrorMessage(error));
        }
      }
    } finally {
      setIsDeletingMatch(false);
    }
  };

  const sendRequest = async (match: Match) => {
    if (isSendingRequest) {
      return;
    }

    if (myTeamIds.has(match.hostTeamId)) {
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

  const cancelAgreedMatch = async (match: Match) => {
    if (isCancelingMatch || match.status !== "avtalt") {
      return;
    }

    const approvedRequest = requests.find(
      (request) =>
        request.id === match.approvedRequestId ||
        (request.matchId === match.id && request.status === "godkjent")
    );

    const canCancel = myTeamIds.has(match.hostTeamId) || Boolean(approvedRequest && myTeamIds.has(approvedRequest.fromTeamId));

    if (!approvedRequest || !canCancel) {
      Alert.alert("Kan ikke avlyse", "Du kan bare avlyse kamper du selv er involvert i.");
      return;
    }

    const previousMatches = matches;
    const previousRequests = requests;

    setIsCancelingMatch(true);
    setMatches((current) =>
      current.map((item) =>
        item.id === match.id ? { ...item, status: "ledig", approvedRequestId: undefined } : item
      )
    );
    setRequests((current) =>
      current.map((item) => (item.id === approvedRequest.id ? { ...item, status: "avslatt" } : item))
    );

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: requestError } = await supabase
          .from("match_requests")
          .update({ status: "avslatt" })
          .eq("id", approvedRequest.id);

        if (requestError) {
          throw requestError;
        }

        const { error: matchError } = await supabase
          .from("matches")
          .update({ status: "ledig", approved_request_id: null })
          .eq("id", match.id);

        if (matchError) {
          throw matchError;
        }
      }

      setSelectedMatchId(null);
    } catch (error) {
      setMatches(previousMatches);
      setRequests(previousRequests);
      Alert.alert("Kampen ble ikke avlyst", getReadableErrorMessage(error));
    } finally {
      setIsCancelingMatch(false);
    }
  };

  const saveProfileChanges = async (profile: TeamProfile) => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      setCurrentProfile(profile);
      setTeamProfiles((current) => current.map((teamProfile) => (teamProfile.id === profile.id ? profile : teamProfile)));
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
    setTeamProfiles((current) =>
      current.map((teamProfile) => (teamProfile.id === updatedProfile.id ? updatedProfile : teamProfile))
    );
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

  const addTeamProfile = async (profile: Omit<TeamProfile, "id" | "contactName" | "phone" | "email">) => {
    const newProfileBase = {
      ...profile,
      contactName: currentProfile.contactName,
      phone: currentProfile.phone,
      email: currentProfile.email
    };

    if (!isSupabaseConfigured || !supabase || !authUserId) {
      const localProfile: TeamProfile = {
        ...newProfileBase,
        id: createLocalId()
      };
      setTeamProfiles((current) => [...current, localProfile]);
      selectTeamProfile(localProfile);
      return;
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({
        user_id: authUserId,
        sport: profile.sport,
        club: profile.team,
        team: profile.team,
        age_group: profile.ageGroup,
        level: profile.level,
        contact_name: currentProfile.contactName
      })
      .select("id, sport, club, team, age_group, level, contact_name, users(email, phone)")
      .single();

    if (error) {
      throw error;
    }

    if (data) {
      const newProfile = mapDatabaseTeam(data as DatabaseTeamRow);
      setTeamProfiles((current) => [...current, newProfile]);
      selectTeamProfile(newProfile);
    }
  };

  const deleteTeamProfile = async (profile: TeamProfile) => {
    if (teamProfiles.length <= 1) {
      throw new Error("Du mÃ¥ ha minst ett lag i appen.");
    }

    const nextProfiles = teamProfiles.filter((teamProfile) => teamProfile.id !== profile.id);
    const nextActiveProfile =
      currentProfile.id === profile.id
        ? nextProfiles[0]
        : currentProfile;

    if (!isSupabaseConfigured || !supabase) {
      setTeamProfiles(nextProfiles);
      selectTeamProfile(nextActiveProfile);
      return;
    }

    const { error: rpcError } = await supabase.rpc("delete_own_team", {
      team_id_to_delete: profile.id
    });

    if (!rpcError) {
      setTeamProfiles(nextProfiles);
      setMatches((current) => current.filter((match) => match.hostTeamId !== profile.id));
      setRequests((current) => current.filter((request) => request.fromTeamId !== profile.id));
      setMessages((current) =>
        current.filter((message) =>
          requests.some((request) => request.id === message.requestId && request.fromTeamId !== profile.id)
        )
      );
      selectTeamProfile(nextActiveProfile);
      return;
    }

    const hostedMatchIds = matches
      .filter((match) => match.hostTeamId === profile.id && isUuid(match.id))
      .map((match) => match.id);
    const requestIds = requests
      .filter(
        (request) =>
          request.fromTeamId === profile.id ||
          hostedMatchIds.includes(request.matchId)
      )
      .map((request) => request.id)
      .filter(isUuid);

    if (requestIds.length > 0) {
      const { error: chatDeleteError } = await supabase.from("chat_messages").delete().in("request_id", requestIds);
      if (chatDeleteError) {
        throw chatDeleteError;
      }

      const { error: requestDeleteError } = await supabase.from("match_requests").delete().in("id", requestIds);
      if (requestDeleteError) {
        throw requestDeleteError;
      }
    }

    if (hostedMatchIds.length > 0) {
      const { error: matchDeleteError } = await supabase.from("matches").delete().in("id", hostedMatchIds);
      if (matchDeleteError) {
        throw matchDeleteError;
      }
    }

    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", profile.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    setTeamProfiles(nextProfiles);
    setMatches((current) => current.filter((match) => match.hostTeamId !== profile.id));
    setRequests((current) =>
      current.filter(
        (request) =>
          request.fromTeamId !== profile.id &&
          !hostedMatchIds.includes(request.matchId)
      )
    );
    setMessages((current) => current.filter((message) => !requestIds.includes(message.requestId)));
    selectTeamProfile(nextActiveProfile);
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
          onCreateMatch={openCreateMatch}
          onOpenMatch={(id) => setSelectedMatchId(id)}
          onHeaderLogoChange={setHomeHeaderLogoVisible}
          pendingIncomingCount={visibleIncomingNotificationCount}
          approvedMyRequestsCount={visibleApprovedNotificationCount}
          onOpenInbox={() => {
            setSeenIncomingCount(pendingIncomingCount);
            saveSeenNotificationCounts(currentProfile.id, pendingIncomingCount, seenApprovedCount);
            setActiveTab("mine");
          }}
          onOpenMine={() => {
            setSeenApprovedCount(approvedMyRequestsCount);
            saveSeenNotificationCounts(currentProfile.id, seenIncomingCount, approvedMyRequestsCount);
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
          onCreateMatch={openCreateMatch}
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
        profiles={teamProfiles}
        requests={requests}
        matches={matches}
        userEmail={userEmail}
        onEditProfile={() => setProfileEditVisible(true)}
        onSignOut={async () => {
          await supabase?.auth.signOut();
          setUserEmail(null);
          setAuthUserId(null);
          setHasTeamProfile(false);
          setCurrentProfile(fallbackProfile);
          setTeamProfiles([]);
          setProfileEditVisible(false);
          setSeenIncomingCount(0);
          setSeenApprovedCount(0);
        }}
        onOpenMatch={(id) => setSelectedMatchId(id)}
        onOpenRequest={(id) => setSelectedRequestId(id)}
      />
    );
  };

  if (legalPage) {
    return <LegalPage type={legalPage} />;
  }

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
          setTeamProfiles([profile]);
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
          profiles={teamProfiles}
          onSelectProfile={(profileId) => {
            const profile = teamProfiles.find((teamProfile) => teamProfile.id === profileId);
            if (profile) {
              selectTeamProfile(profile);
            }
          }}
          showHomeLogo={activeTab === "home" && homeHeaderLogoVisible}
        />
        <View style={styles.content}>{renderContent()}</View>
        <BottomTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          badges={{ inbox: visibleApprovedNotificationCount, mine: visibleIncomingNotificationCount }}
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
        onSubmit={updateMatch}
      />

      <ProfileEditModal
        visible={profileEditVisible}
        profile={currentProfile}
        profiles={teamProfiles}
        onClose={() => setProfileEditVisible(false)}
        onSave={saveProfileChanges}
        onAddTeam={addTeamProfile}
        onDeleteTeam={deleteTeamProfile}
      />

      <MatchDetailsModal
        match={selectedMatch}
        profile={selectedMatchProfile}
        requests={requests}
        isSendingRequest={isSendingRequest}
        isDeletingMatch={isDeletingMatch}
        isCancelingMatch={isCancelingMatch}
        onClose={() => setSelectedMatchId(null)}
        onSendRequest={sendRequest}
        onEditMatch={openEditMatch}
        onDeleteMatch={deleteMatch}
        onCancelAgreedMatch={cancelAgreedMatch}
        onOpenChat={(requestId) => {
          setSelectedRequestId(requestId);
          setTimeout(() => setSelectedMatchId(null), 0);
        }}
      />

      <RequestDetailsModal
        request={selectedRequest}
        profile={selectedRequestProfile}
        match={selectedRequestMatch}
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
  profiles,
  onSelectProfile,
  showHomeLogo
}: {
  title: string;
  profile: TeamProfile;
  profiles: TeamProfile[];
  onSelectProfile: (profileId: string) => void;
  showHomeLogo: boolean;
}) {
  return (
    <View style={styles.header}>
      {title ? (
        <Text style={styles.headerTitle}>{title}</Text>
      ) : (
        <View style={styles.headerProfileWrap}>
          <Text style={styles.headerProfileName}>{profile.contactName}</Text>
          {profiles.length > 1 ? (
            <Pressable
              style={styles.headerTeamSwitch}
              onPress={() => {
                const currentIndex = profiles.findIndex((teamProfile) => teamProfile.id === profile.id);
                const nextProfile = profiles[(currentIndex + 1) % profiles.length];
                onSelectProfile(nextProfile.id);
              }}
            >
              <Text style={styles.headerTeamSwitchText}>{formatProfileTeamLine(profile)}</Text>
              <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Text style={styles.headerProfileTeam}>{formatProfileTeamLine(profile)}</Text>
          )}
        </View>
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
            secureTextEntry
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

function LegalPage({ type }: { type: "privacy" | "terms" }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Personvernerklæring" : "Brukervilkår";
  const sections = isPrivacy ? privacySections : termsSections;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.legalPage}>
        <PlayrLogo compact />
        <Text style={styles.legalTitle}>{title}</Text>
        <Text style={styles.legalUpdated}>Sist oppdatert: 14.05.2026</Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.legalSection}>
            <Text style={styles.legalSectionTitle}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.legalText}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
        <Text style={styles.legalContact}>Kontakt: kontakt@playrmatch.com</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const privacySections = [
  {
    title: "1. Om Playr",
    body: [
      "Playr er en app for trenere og lag som vil finne, avtale og administrere treningskamper.",
      "Playr drives i v1 av Tommy Ottesen."
    ]
  },
  {
    title: "2. Opplysninger vi behandler",
    body: [
      "Playr kan behandle e-postadresse, navn på kontaktperson, telefonnummer, lagopplysninger, kampopplysninger, forespørsler og chatmeldinger knyttet til kamper.",
      "Passord håndteres av Supabase Auth. Playr lagrer ikke passord direkte i appkoden."
    ]
  },
  {
    title: "3. Hvorfor opplysningene brukes",
    body: [
      "Opplysningene brukes for å opprette konto og lagprofil, vise relevante kamper, sende og behandle forespørsler, vise kontaktinformasjon mellom involverte lag og la lag chatte om avtalte kamper."
    ]
  },
  {
    title: "4. Lagring og databehandler",
    body: [
      "Playr bruker Supabase som teknisk leverandør for innlogging, database og lagring av appdata."
    ]
  },
  {
    title: "5. Deling",
    body: [
      "Opplysninger deles ikke med annonsenettverk eller tredjeparter for markedsføring.",
      "Relevant kamp-, lag- og kontaktinformasjon kan vises til andre brukere i appen når det er nødvendig for å finne, forespørre eller avtale treningskamper."
    ]
  },
  {
    title: "6. Lokal lagring",
    body: [
      "Appen kan lagre enkle innstillinger lokalt i nettleseren, for eksempel interne tellere for hvilke badges brukeren allerede har sett."
    ]
  },
  {
    title: "7. Rettigheter",
    body: [
      "Brukere kan be om innsyn, retting eller sletting av egne opplysninger ved å kontakte kontakt@playrmatch.com."
    ]
  },
  {
    title: "8. Barn og unge",
    body: [
      "Playr er laget for trenere og lagledere. Appen er ikke ment for at barn selv skal opprette konto uten nødvendig samtykke fra foresatte eller klubb/lagansvarlig der dette kreves."
    ]
  }
];

const termsSections = [
  {
    title: "1. Om tjenesten",
    body: [
      "Playr hjelper trenere og lag med å publisere, finne og avtale treningskamper.",
      "Playr drives i v1 av Tommy Ottesen."
    ]
  },
  {
    title: "2. Brukerkonto",
    body: [
      "Du er ansvarlig for at informasjonen du legger inn er korrekt, inkludert lag, kontaktperson, kontaktinformasjon og kampdetaljer."
    ]
  },
  {
    title: "3. Publisering av kamper",
    body: [
      "Når du legger ut en kamp, er du ansvarlig for at tidspunkt, sted, nivå og øvrig informasjon er riktig."
    ]
  },
  {
    title: "4. Forespørsler og avtaler",
    body: [
      "En kamp regnes som avtalt når en forespørsel er godkjent i appen. Lagene er selv ansvarlige for praktiske avklaringer rundt oppmøte, bane, dommer, avlysning og lignende."
    ]
  },
  {
    title: "5. Chat og kommunikasjon",
    body: [
      "Chat skal brukes til relevant og ryddig kommunikasjon om kamper. Brukere skal ikke sende støtende, ulovlig eller misvisende innhold."
    ]
  },
  {
    title: "6. Tilgjengelighet",
    body: [
      "Playr leveres som den er. Det kan forekomme feil, nedetid eller endringer i funksjonalitet, særlig i test- og tidlig lanseringsfase."
    ]
  },
  {
    title: "7. Misbruk",
    body: [
      "Kontoer eller lagprofiler kan fjernes dersom appen misbrukes, det legges inn uriktig informasjon, eller brukeren opptrer på en måte som skader andre brukere eller tjenesten."
    ]
  },
  {
    title: "8. Ansvar",
    body: [
      "Playr er et verktøy for kontakt og kampavtaler. Playr er ikke ansvarlig for gjennomføring av kamper, skader, avlysninger eller forhold mellom lagene."
    ]
  }
];

function getLegalPageFromPath(): "privacy" | "terms" | null {
  if (typeof window === "undefined") {
    return null;
  }

  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();

  if (path === "/personvern") {
    return "privacy";
  }

  if (path === "/vilkar" || path === "/vilkår") {
    return "terms";
  }

  return null;
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

    if (!contactName.trim() || !team.trim() || !getAgeGroupPrefix(ageGroup) || !getAgeGroupNumber(ageGroup)) {
      setFeedback("Fyll inn trenernavn, lag og årskull.");
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
        age_group: formatAgeGroup(ageGroup),
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
            <AgeGroupInput value={ageGroup} onChangeText={setAgeGroup} />
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
  profiles,
  onClose,
  onSave,
  onAddTeam,
  onDeleteTeam
}: {
  visible: boolean;
  profile: TeamProfile;
  profiles: TeamProfile[];
  onClose: () => void;
  onSave: (profile: TeamProfile) => Promise<void>;
  onAddTeam: (profile: Omit<TeamProfile, "id" | "contactName" | "phone" | "email">) => Promise<void>;
  onDeleteTeam: (profile: TeamProfile) => Promise<void>;
}) {
  const [contactName, setContactName] = useState(profile.contactName);
  const [sport, setSport] = useState<Sport>(profile.sport);
  const [team, setTeam] = useState(profile.team);
  const [ageGroup, setAgeGroup] = useState(profile.ageGroup);
  const [phone, setPhone] = useState(profile.phone);
  const [newTeamSport, setNewTeamSport] = useState<Sport>(profile.sport);
  const [newTeam, setNewTeam] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setContactName(profile.contactName);
    setSport(profile.sport);
    setTeam(profile.team);
    setAgeGroup(profile.ageGroup);
    setPhone(profile.phone);
    setNewTeamSport(profile.sport);
    setNewTeam("");
    setNewAgeGroup("");
    setDeletingTeamId(null);
    setFeedback(null);
  }, [visible, profile]);

  const save = async () => {
    if (!contactName.trim() || !team.trim() || !getAgeGroupPrefix(ageGroup) || !getAgeGroupNumber(ageGroup)) {
      setFeedback("Fyll inn trenernavn, lag og årskull.");
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
        ageGroup: formatAgeGroup(ageGroup),
        phone: phone.trim()
      });
    } catch (error) {
      setFeedback(getReadableErrorMessage(error, "Profilen kunne ikke lagres."));
    } finally {
      setSaving(false);
    }
  };

  const addTeam = async () => {
    if (!newTeam.trim() || !getAgeGroupPrefix(newAgeGroup) || !getAgeGroupNumber(newAgeGroup)) {
      setFeedback("Fyll inn lag, G/J og årskull for ekstra lag.");
      return;
    }

    setAddingTeam(true);
    setFeedback(null);

    try {
      await onAddTeam({
        sport: newTeamSport,
        club: newTeam.trim(),
        team: newTeam.trim(),
        ageGroup: formatAgeGroup(newAgeGroup),
        level: ""
      });
      setNewTeam("");
      setNewAgeGroup("");
    } catch (error) {
      setFeedback(getReadableErrorMessage(error, "Laget kunne ikke legges til."));
    } finally {
      setAddingTeam(false);
    }
  };

  const confirmDeleteTeam = (teamProfile: TeamProfile) => {
    if (profiles.length <= 1) {
      setFeedback("Du mÃ¥ ha minst ett lag i appen.");
      return;
    }

    const deleteMessage = `${formatProfileTeamLine(teamProfile)} fjernes fra appen. Kamper og forespÃ¸rsler som hÃ¸rer til laget kan ogsÃ¥ bli fjernet.`;

    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(`Slette lag?\n\n${deleteMessage}`)) {
        deleteTeam(teamProfile);
      }
      return;
    }

    Alert.alert(
      "Slette lag?",
      deleteMessage,
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett lag",
          style: "destructive",
          onPress: () => deleteTeam(teamProfile)
        }
      ]
    );
  };

  const deleteTeam = async (teamProfile: TeamProfile) => {
    setDeletingTeamId(teamProfile.id);
    setFeedback(null);

    try {
      await onDeleteTeam(teamProfile);
    } catch (error) {
      setFeedback(getReadableErrorMessage(error, "Laget kunne ikke slettes."));
    } finally {
      setDeletingTeamId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="none" presentationStyle="pageSheet">
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
            <AgeGroupInput value={ageGroup} onChangeText={setAgeGroup} />
            <Input
              label="Telefon (valgfritt)"
              value={phone}
              onChangeText={setPhone}
              placeholder="Eks: 900 00 000"
            />
            <ReadonlyField label="E-post" value={profile.email} />

            <View style={styles.profileTeamsBox}>
              <Text style={styles.sectionTitle}>Lag i appen</Text>
              {profiles.map((teamProfile) => (
                <View key={teamProfile.id} style={styles.profileTeamRow}>
                  <Text style={styles.profileTeamLine}>
                    {formatProfileTeamLine(teamProfile)}
                  </Text>
                  <Pressable
                    style={[
                      styles.profileTeamDeleteButton,
                      (profiles.length <= 1 || deletingTeamId === teamProfile.id) && styles.disabledButton
                    ]}
                    disabled={profiles.length <= 1 || deletingTeamId === teamProfile.id}
                    onPress={() => confirmDeleteTeam(teamProfile)}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.red} />
                  </Pressable>
                </View>
              ))}
            </View>

            <View style={styles.profileTeamsBox}>
              <Text style={styles.sectionTitle}>Legg til ekstra lag</Text>
              <Text style={styles.inputLabel}>Idrett</Text>
              <View style={styles.pickerField}>
                <Picker
                  selectedValue={newTeamSport}
                  onValueChange={(value: Sport) => setNewTeamSport(value)}
                  style={styles.formPicker}
                >
                  <Picker.Item label="Fotball" value="Fotball" />
                  <Picker.Item label="Håndball" value="Handball" />
                </Picker>
              </View>
              <Input
                label="Lag"
                value={newTeam}
                onChangeText={setNewTeam}
                placeholder="Eks: Glassverket G12"
              />
              <AgeGroupInput value={newAgeGroup} onChangeText={setNewAgeGroup} />
              <Pressable
                style={[styles.secondaryButtonFull, addingTeam && styles.disabledButton]}
                disabled={addingTeam}
                onPress={addTeam}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.greenDark} />
                <Text style={styles.secondaryButtonText}>
                  {addingTeam ? "Legger til..." : "Legg til lag"}
                </Text>
              </Pressable>
            </View>

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
      getAgeGroupDisplay(match.ageGroup) === getAgeGroupDisplay(profile.ageGroup) &&
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
                  ? "Du har 1 ny forespørsel."
                  : `Du har ${pendingIncomingCount} nye forespørsler.`}
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
                {activeMatch.date} · {activeMatch.time} · {activeMatch.place}
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
  const [ageFilter, setAgeFilter] = useState("Alle");
  const [hideAgreed, setHideAgreed] = useState(false);
  const [searchText, setSearchText] = useState("");

  const ageOptions = useMemo(
    () =>
      Array.from(new Set(matches.map((match) => getAgeGroupDisplay(match.ageGroup)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "no-NO", { numeric: true })
      ),
    [matches]
  );
  const filtered = matches
    .filter((match) => {
      const sportMatches = sportFilter === "Alle" || match.sport === sportFilter;
    const ageMatches = ageFilter === "Alle" || getAgeGroupDisplay(match.ageGroup) === ageFilter;
      const statusMatches = !hideAgreed || match.status !== "avtalt";
      const search = searchText.trim().toLowerCase();
      const searchMatches =
        !search ||
        [match.title, match.hostClub, match.hostTeam, match.place, match.city, getAgeGroupDisplay(match.ageGroup), match.level]
          .join(" ")
          .toLowerCase()
          .includes(search);
      return sportMatches && ageMatches && statusMatches && searchMatches;
    })
    .sort((a, b) => {
      const statusA = a.status === "avtalt" ? 1 : 0;
      const statusB = b.status === "avtalt" ? 1 : 0;
      return statusA - statusB || getMatchDateSortValue(a) - getMatchDateSortValue(b);
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
        <View style={styles.filterPill}>
          <Picker
            selectedValue={ageFilter}
            onValueChange={setAgeFilter}
            style={styles.compactPicker}
          >
            <Picker.Item label="Alle årskull" value="Alle" />
            {ageOptions.map((age) => (
              <Picker.Item key={age} label={age} value={age} />
            ))}
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

    return requests.some(
      (request) =>
        request.matchId === match.id &&
        request.fromTeamId === profile.id &&
        request.status === "godkjent"
    );
  });

  return (
    <FlatList
      data={agreedMatches}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<EmptyState text="Ingen avtalte kamper enda." />}
      renderItem={({ item }) => {
        const approvedRequest = requests.find((request) => request.id === item.approvedRequestId);
        const hasMyRequest = requests.some(
          (request) =>
            request.matchId === item.id &&
            request.fromTeamId === profile.id &&
            request.status === "godkjent"
        );

        return (
          <MatchCard
            match={item}
            hasMyRequest={hasMyRequest}
            approvedRequest={approvedRequest}
            onPress={() => onOpenMatch(item.id)}
          />
        );
      }}
    />
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
                <InfoLine icon="location-outline" text={match.place} />
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

function MineScreen({
  profile,
  profiles,
  requests,
  matches,
  userEmail,
  onEditProfile,
  onSignOut,
  onOpenMatch,
  onOpenRequest
}: {
  profile: TeamProfile;
  profiles: TeamProfile[];
  requests: MatchRequest[];
  matches: Match[];
  userEmail: string | null;
  onEditProfile: () => void;
  onSignOut: () => void;
  onOpenMatch: (id: string) => void;
  onOpenRequest: (id: string) => void;
}) {
  const allProfiles = profiles.some((teamProfile) => teamProfile.id === profile.id)
    ? profiles
    : [profile, ...profiles];
  const ownedTeamIds = new Set(allProfiles.map((teamProfile) => teamProfile.id));
  const ownedHostedMatches = matches.filter((match) => isMatchOwnedByProfiles(match, allProfiles));
  const ownedRequests = requests.filter((request) => ownedTeamIds.has(request.fromTeamId));
  const approvedRequestMatches = ownedRequests
    .filter((request) => request.status === "godkjent")
    .map((request) => matches.find((match) => match.id === request.matchId))
    .filter((match): match is Match => Boolean(match))
    .filter((match) => !ownedHostedMatches.some((hostedMatch) => hostedMatch.id === match.id));
  const myMatches = [...ownedHostedMatches, ...approvedRequestMatches];
  const agreedMyMatches = myMatches.filter((match) => match.status === "avtalt").length;
  const activeHostedMatches = ownedHostedMatches
    .filter((match) => match.status !== "avtalt")
    .sort((a, b) => getMatchDateSortValue(a) - getMatchDateSortValue(b));
  const activeMyRequests = ownedRequests.filter((request) => {
    const match = matches.find((candidate) => candidate.id === request.matchId);
    return request.status === "venter" && match?.status !== "avtalt";
  });
  const sortedMyRequests = [...activeMyRequests].sort(
    (a, b) =>
      getRequestSortValue(a.status) - getRequestSortValue(b.status) ||
      getRequestMatchDateSortValue(a, matches) - getRequestMatchDateSortValue(b, matches)
  );
  const activeHostedIds = new Set(activeHostedMatches.map((match) => match.id));
  const activeIncomingRequests = requests
    .filter((request) => request.status === "venter" && activeHostedIds.has(request.matchId))
    .sort(
      (a, b) =>
        getRequestMatchDateSortValue(a, matches) - getRequestMatchDateSortValue(b, matches)
    );
  const pendingRequests = activeMyRequests.length + activeIncomingRequests.length;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.accountBox}>
        <Text style={styles.sectionLabel}>Innlogget konto</Text>
        <Text style={styles.accountEmail}>{userEmail ?? "Ukjent bruker"}</Text>
        <Text style={styles.accountProfileText}>
          {profile.contactName} · {formatSport(profile.sport)} · {profile.team} · {getAgeGroupDisplay(profile.ageGroup)}
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
          <Text style={styles.mineStatNumber}>{myMatches.length}</Text>
          <Text style={styles.mineStatLabel}>Mine</Text>
        </View>
        <View style={styles.mineStatItem}>
          <Text style={styles.mineStatNumber}>{agreedMyMatches}</Text>
          <Text style={styles.mineStatLabel}>Avtalt</Text>
        </View>
        <View style={styles.mineStatItem}>
          <Text style={styles.mineStatNumber}>{pendingRequests}</Text>
          <Text style={styles.mineStatLabel}>Venter</Text>
        </View>
      </View>

      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Forespørsler på mine kamper</Text>
        <Text style={styles.mineSectionCount}>{activeIncomingRequests.length}</Text>
      </View>
      {activeIncomingRequests.length === 0 ? <EmptyState text="Ingen nye forespørsler på dine kamper." /> : null}
      {activeIncomingRequests.map((request) => {
        const match = matches.find((candidate) => candidate.id === request.matchId);
        if (!match) {
          return null;
        }

        return (
          <MatchCard
            key={request.id}
            match={match}
            hasMyRequest={false}
            approvedRequest={undefined}
            onPress={() => onOpenRequest(request.id)}
          />
        );
      })}

      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Kamper jeg har lagt ut</Text>
        <Text style={styles.mineSectionCount}>{activeHostedMatches.length}</Text>
      </View>
      {activeHostedMatches.length === 0 ? <EmptyState text="Du har ingen aktive kamper ute nå." /> : null}
      {activeHostedMatches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          hasMyRequest={false}
          approvedRequest={requests.find((request) => request.id === match.approvedRequestId)}
          onPress={() => onOpenMatch(match.id)}
        />
      ))}

      <View style={styles.mineSectionHeader}>
        <Text style={styles.sectionTitle}>Mine forespørsler</Text>
        <Text style={styles.mineSectionCount}>{activeMyRequests.length}</Text>
      </View>
      {activeMyRequests.length === 0 ? <EmptyState text="Du har ingen aktive forespørsler nå." /> : null}
      {sortedMyRequests.map((request) => {
        const match = matches.find((candidate) => candidate.id === request.matchId);
        if (!match) {
          return null;
        }
        return (
          <MatchCard
            key={request.id}
            match={match}
            hasMyRequest
            approvedRequest={undefined}
            onPress={() => onOpenRequest(request.id)}
          />
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
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{match.status}</Text>
        </View>
      </View>

      <Text style={styles.cardCompactMeta} numberOfLines={1}>
        {formatSport(match.sport)} · {getAgeGroupDisplay(match.ageGroup)} · {match.level} · {match.date} {match.time} · {match.place}
      </Text>
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
    <Modal visible={visible} animationType="none" presentationStyle="pageSheet">
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
                style={styles.formPicker}
              >
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Håndball" value="Handball" />
              </Picker>
            </View>

            <AgeGroupInput value={form.ageGroup} onChangeText={(ageGroup) => onChange({ ...form, ageGroup })} />
            <LevelInput value={form.level} onChangeText={(level) => onChange({ ...form, level })} />
            <Input label="Dato" value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="Eks: 15.06.2026" />
            <Input label="Tid" value={form.time} onChangeText={(time) => onChange({ ...form, time })} placeholder="Eks: 18:00" />
            <Input label="Bane/sted" value={form.place} onChangeText={(place) => onChange({ ...form, place })} placeholder="Eks: Marienlyst stadion" />
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
    <Modal visible animationType="none" presentationStyle="pageSheet">
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
            <Text style={styles.inputLabel}>Idrett</Text>
            <View style={styles.pickerField}>
              <Picker
                selectedValue={form.sport}
                onValueChange={(sport: Sport) => onChange({ ...form, sport })}
                style={styles.formPicker}
              >
                <Picker.Item label="Fotball" value="Fotball" />
                <Picker.Item label="Håndball" value="Handball" />
              </Picker>
            </View>
            <AgeGroupInput value={form.ageGroup} onChangeText={(ageGroup) => onChange({ ...form, ageGroup })} />
            <LevelInput value={form.level} onChangeText={(level) => onChange({ ...form, level })} />
            <Input label="Dato" value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="Eks: 15.06.2026" />
            <Input label="Tid" value={form.time} onChangeText={(time) => onChange({ ...form, time })} placeholder="Eks: 18:00" />
            <Input label="Bane/sted" value={form.place} onChangeText={(place) => onChange({ ...form, place })} placeholder="Eks: Marienlyst stadion" />
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
  isDeletingMatch,
  isCancelingMatch,
  onClose,
  onSendRequest,
  onEditMatch,
  onDeleteMatch,
  onCancelAgreedMatch,
  onOpenChat
}: {
  match: Match | null;
  profile: TeamProfile;
  requests: MatchRequest[];
  isSendingRequest: boolean;
  isDeletingMatch: boolean;
  isCancelingMatch: boolean;
  onClose: () => void;
  onSendRequest: (match: Match) => void;
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (match: Match) => void;
  onCancelAgreedMatch: (match: Match) => void;
  onOpenChat: (requestId: string) => void;
}) {
  if (!match) {
    return null;
  }

  const myRequest = requests.find(
    (request) => request.matchId === match.id && request.fromTeamId === profile.id
  );
  const approvedRequest = requests.find(
    (request) =>
      request.id === match.approvedRequestId ||
      (request.matchId === match.id &&
        request.status === "godkjent" &&
        (request.fromTeamId === profile.id || match.hostTeamId === profile.id))
  );
  const isOwnMatch = match.hostTeamId === profile.id;
  const requestButtonDisabled =
    isSendingRequest || match.status === "avtalt" || Boolean(myRequest && myRequest.status !== "avslatt");

  return (
    <Modal visible animationType="none" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.matchModalHeader}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.details}>
          <MatchCard match={match} hasMyRequest={Boolean(myRequest)} onPress={() => undefined} />

          <Text style={styles.sectionTitle}>Kampinfo</Text>
          <DetailRow label="Idrett" value={formatSport(match.sport)} />
          <DetailRow label="Alder" value={getAgeGroupDisplay(match.ageGroup)} />
          <DetailRow label="Nivå" value={match.level} />
          <DetailRow label="Dato" value={`${match.date} ${match.time}`} />
          <DetailRow label="Bane/sted" value={match.place} />
          <Pressable style={styles.mapButton} onPress={() => openMapForPlace(match.place)}>
            <Ionicons name="map-outline" size={18} color={colors.greenDark} />
            <Text style={styles.mapButtonText}>Åpne i kart</Text>
          </Pressable>
          <DetailRow label="Type" value={match.matchType} />

          <Text style={styles.sectionTitle}>Kontakt</Text>
          <DetailRow label="Klubb" value={match.hostClub} />
          <DetailRow label="Lag" value={match.hostTeam} />
          <DetailRow label="Kontaktperson" value={match.contactName} />

          <Text style={styles.sectionTitle}>Kommentar</Text>
          <Text style={styles.paragraph}>{match.comment || "Ingen kommentar."}</Text>

          {match.status === "avtalt" && approvedRequest ? (
            <Pressable style={styles.secondaryButtonFull} onPress={() => onOpenChat(approvedRequest.id)}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.greenDark} />
              <Text style={styles.secondaryButtonText}>Åpne chat</Text>
            </Pressable>
          ) : null}

          {!isOwnMatch ? (
            match.status === "avtalt" && myRequest?.status === "godkjent" ? (
              <Pressable
                style={[styles.dangerButton, isCancelingMatch && styles.disabledButton]}
                disabled={isCancelingMatch}
                onPress={() => onCancelAgreedMatch(match)}
              >
                <Text style={styles.dangerButtonText}>
                  {isCancelingMatch ? "Avlyser..." : "Avlys kamp"}
                </Text>
              </Pressable>
            ) : (
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
            )
          ) : (
            <View style={styles.actionStack}>
              <Text style={styles.requestHint}>Dette er en kamp du har lagt ut.</Text>
              <Pressable style={styles.secondaryButtonFull} onPress={() => onEditMatch(match)}>
                <Ionicons name="create-outline" size={18} color={colors.greenDark} />
                <Text style={styles.secondaryButtonText}>Rediger kamp</Text>
              </Pressable>
              {match.status === "avtalt" ? (
                <Pressable
                  style={[styles.dangerButton, isCancelingMatch && styles.disabledButton]}
                  disabled={isCancelingMatch}
                  onPress={() => onCancelAgreedMatch(match)}
                >
                  <Text style={styles.dangerButtonText}>
                    {isCancelingMatch ? "Avlyser..." : "Avlys kamp"}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.dangerButton, isDeletingMatch && styles.disabledButton]}
                disabled={isDeletingMatch}
                onPress={() => onDeleteMatch(match)}
              >
                <Text style={styles.dangerButtonText}>
                  {isDeletingMatch ? "Sletter..." : "Slett kamp"}
                </Text>
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
    <Modal visible animationType="none" presentationStyle="pageSheet">
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
    { key: "inbox", label: "Mine kamper", icon: "file-tray-outline" },
    { key: "mine", label: "Forespørsler", icon: "person-outline" }
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
  multiline,
  secureTextEntry = false
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
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
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function LevelInput({
  value,
  onChangeText
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View>
      <Text style={styles.inputLabel}>Nivå</Text>
      <View style={styles.levelInputRow}>
        <Text style={styles.levelInputPrefix}>Nivå</Text>
        <TextInput
          style={styles.levelInput}
          value={getLevelNumber(value)}
          onChangeText={(text) => onChangeText(getLevelNumber(text))}
          keyboardType="number-pad"
          maxLength={1}
        />
      </View>
      <Text style={styles.levelHelpText}>
        Hvilket nivå er laget ditt? 1=Øvd - 2=Middels - 3=Mindre Øvd
      </Text>
    </View>
  );
}

function AgeGroupInput({
  value,
  onChangeText
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const prefix = getAgeGroupPrefix(value);
  const birthYear = getAgeGroupInputNumber(value);
  const updateValue = (nextPrefix: string, nextBirthYear: string) => onChangeText(`${nextPrefix}${nextBirthYear}`);

  return (
    <View>
      <Text style={styles.inputLabel}>Årskull</Text>
      <View style={styles.ageGroupRow}>
        <View style={styles.ageGroupToggle}>
          {(["G", "J"] as const).map((option) => {
            const selected = prefix === option;
            return (
              <Pressable
                key={option}
                style={[styles.ageGroupOption, selected && styles.ageGroupOptionSelected]}
                onPress={() => updateValue(option, birthYear)}
              >
                <Text style={[styles.ageGroupOptionText, selected && styles.ageGroupOptionTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={[styles.ageGroupInput, !birthYear && styles.ageGroupInputEmpty]}
          value={birthYear}
          onChangeText={(text) => updateValue(prefix, text.replace(/\D/g, "").slice(0, 4))}
          placeholder="Eks. 2014"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
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

function openMapForPlace(place: string) {
  const query = encodeURIComponent(place.trim());
  if (!query) {
    return;
  }

  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
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

function formatProfileTeamLine(profile: TeamProfile) {
  const team = profile.team.trim();
  const ageGroup = getAgeGroupDisplay(profile.ageGroup).trim();
  return ageGroup && !team.toLowerCase().includes(ageGroup.toLowerCase())
    ? `${team} · ${ageGroup}`
    : team;
}

function normalizeOwnerValue(value: string) {
  return value.trim().toLowerCase();
}

function getProfileForMatch(match: Match, profiles: TeamProfile[]) {
  return (
    profiles.find((profile) => profile.id === match.hostTeamId) ??
    profiles.find(
      (profile) =>
        normalizeOwnerValue(profile.contactName) === normalizeOwnerValue(match.contactName) &&
        getAgeGroupDisplay(profile.ageGroup) === getAgeGroupDisplay(match.ageGroup)
    ) ??
    null
  );
}

function isMatchOwnedByProfiles(match: Match, profiles: TeamProfile[]) {
  return Boolean(getProfileForMatch(match, profiles));
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

function getMatchDateSortValue(match: Match) {
  const databaseDate = parseDateForDatabase(match.date);
  const databaseTime = parseTimeForDatabase(match.time) ?? "00:00:00";

  if (!databaseDate) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = new Date(`${databaseDate}T${databaseTime}`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getRequestMatchDateSortValue(request: MatchRequest, matches: Match[]) {
  const match = matches.find((candidate) => candidate.id === request.matchId);
  return match ? getMatchDateSortValue(match) : Number.MAX_SAFE_INTEGER;
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
  profileTeamsBox: {
    gap: 12,
    marginTop: 4
  },
  profileTeamRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  profileTeamLine: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.greenDark,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    padding: 12
  },
  profileTeamDeleteButton: {
    alignItems: "center",
    backgroundColor: colors.redSoft,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44
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
  legalPage: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: 16,
    padding: 24,
    paddingBottom: 36
  },
  legalTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  legalUpdated: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  legalSection: {
    gap: 7
  },
  legalSectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  legalText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21
  },
  legalContact: {
    color: colors.greenDark,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6
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
  headerProfileWrap: {
    alignItems: "flex-start",
    left: 22,
    position: "absolute",
    right: 22,
    top: 8
  },
  headerProfileName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3
  },
  headerProfileTeam: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  headerTeamSwitch: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "flex-start",
    maxWidth: 260,
    paddingVertical: 2
  },
  headerTeamSwitchText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900"
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
    fontSize: 16,
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
    gap: 10,
    padding: 16,
    paddingBottom: 28
  },
  matchCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10
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
    fontSize: 15,
    fontWeight: "800"
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  cardDetails: {
    gap: 6,
    marginTop: 10
  },
  statusBadge: {
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  statusText: {
    fontSize: 12,
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
    fontSize: 13
  },
  requestHint: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8
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
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 12,
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
  matchModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingTop: 10
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
  levelInputRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingHorizontal: 14
  },
  levelInputPrefix: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8
  },
  levelInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minHeight: 50
  },
  levelHelpText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 4
  },
  ageGroupRow: {
    flexDirection: "row",
    gap: 8
  },
  ageGroupToggle: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    overflow: "hidden",
    width: 108
  },
  ageGroupOption: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  ageGroupOptionSelected: {
    backgroundColor: colors.cardSoft
  },
  ageGroupOptionText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  ageGroupOptionTextSelected: {
    color: colors.greenDark
  },
  ageGroupPickerWrap: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 0,
    justifyContent: "center",
    minHeight: 50,
    overflow: "hidden",
    width: 96
  },
  ageGroupPicker: {
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    minHeight: 50
  },
  ageGroupInput: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 0,
    fontSize: 18,
    fontWeight: "700",
    minHeight: 50,
    paddingHorizontal: 14,
    width: 86
  },
  ageGroupInputEmpty: {
    fontSize: 9
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
  formPicker: {
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    minHeight: 50
  },
  primaryButtonFull: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18
  },
  secondaryButtonFull: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: "900"
  },
  mapButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 13
  },
  mapButtonText: {
    color: colors.greenDark,
    fontSize: 14,
    fontWeight: "900"
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
