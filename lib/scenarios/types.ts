export type Condition =
  | { task_done: string }
  | { submitted: string }
  | { counter_at_least: { counter: string; value: number } }
  | { messages_sent: { to: string; at_least: number } }
  | { trigger_fired: string }
  | { all: Condition[] }
  | { any: Condition[] };

export type Action =
  | { message: { from: string; text: string } }
  | { unlock: string }
  | { ai_reply: { from: string; direction: string } }
  | { open: string };

export type HiddenFact = {
  id: string;
  fact: string;
  reveal_if: string;
};

export type DayCharacter = {
  id: string;
  available: "start" | "locked";
  opener: string | null;
  today: string;
  hidden_facts: HiddenFact[];
  limits?: { data_pulls?: number; questions?: number };
  reply_flags?: string[];
};

export type GroupChat = {
  id: string;
  name: string;
  members: string[];
  available: "start" | "locked";
  opener: string | null;
};

export type Task = {
  id: string;
  title: string;
  minutes: number;
  kind: "submission" | "chat";
  description: string;
  submit_to?: string;
  done_when: Condition;
};

export type Trigger = {
  id: string;
  when: Condition;
  do: Action[];
};

export type PublicInboxItem = {
  from: string;
  time: string;
  subject: string;
  body: string;
};

export type PublicDashboard = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: { cells: string[]; miss?: boolean }[];
  notes?: string[];
};

export type PublicReview = { text: string; meta: string };

export type PublicDocument = {
  id?: string;
  title: string;
  body?: string;
  content?: string;
};

export type DayScenario = {
  schema_version: string;
  track: string;
  day: number;
  id: string;
  version: number;
  title: string;
  theme: string;
  duration_minutes: [number, number];
  skills_focus: string[];
  practised: string[];
  story_so_far: string;
  world_today: string;
  canon_after_day: string;
  public: {
    inbox: PublicInboxItem[];
    dashboard: PublicDashboard;
    reviews: PublicReview[];
    documents: PublicDocument[];
  };
  characters: DayCharacter[];
  group_chats: GroupChat[];
  tasks: Task[];
  triggers: Trigger[];
  clock: {
    start: string;
    end: string;
    steps: { when: Condition; time: string }[];
  };
  scoring: {
    strong_player: string;
    expected_answers: Record<string, string>;
    common_mistakes: string[];
    senior_view: string;
    drill: string;
  };
};

export type CastMember = {
  id: string;
  name: string;
  role: string;
  kind: string;
  color: string;
  initials: string;
  first_day: number;
  persona: string;
};

export type TrackScenario = {
  schema_version: string;
  id: string;
  version: number;
  title: string;
  role: string;
  company: {
    name: string;
    one_liner: string;
    world_briefing: string;
  };
  days: { day: number; file: string; title: string }[];
  skills: { id: string; name: string; description: string }[];
  cast: CastMember[];
  assistant: {
    id: string;
    name: string;
    role: string;
    opener: string;
    rules: string;
  };
  style_rules: string;
  scorer: {
    instructions: string;
    output_schema: Record<string, unknown>;
  };
  learning_library: Record<
    string,
    { type: string; title: string; by: string; why: string; search: string }[]
  >;
};

export type ChatMessage = {
  id: string;
  thread: string;
  sender: "learner" | string;
  text: string;
  createdAt: string;
  system?: boolean;
};

export type DayRunState = {
  id: string;
  trackId: string;
  day: number;
  scenarioVersion: number;
  learnerName: string;
  unlocked: string[];
  counters: Record<string, number>;
  triggersFired: string[];
  tasksDone: string[];
  submissions: Record<string, { text: string; createdAt: string }>;
  messages: ChatMessage[];
  threadSummaries: Record<string, string>;
  openHint: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicCast = {
  id: string;
  name: string;
  role: string;
  kind: string;
  color: string;
  initials: string;
};

export type PublicDayPayload = {
  runId: string;
  track: {
    id: string;
    title: string;
    role: string;
    companyName: string;
    companyOneLiner: string;
  };
  day: {
    day: number;
    title: string;
    theme: string;
    practised: string[];
    duration_minutes: [number, number];
  };
  clock: string;
  public: DayScenario["public"];
  cast: PublicCast[];
  assistant: { id: string; name: string; role: string; opener: string };
  characters: {
    id: string;
    available: boolean;
    locked: boolean;
    opener: string | null;
    limits?: DayCharacter["limits"];
    reply_flags?: string[];
  }[];
  groupChats: {
    id: string;
    name: string;
    members: string[];
    available: boolean;
    opener: string | null;
  }[];
  tasks: {
    id: string;
    title: string;
    minutes: number;
    kind: Task["kind"];
    description: string;
    submit_to?: string;
    done: boolean;
  }[];
  messages: ChatMessage[];
  counters: Record<string, number>;
  openHint: string | null;
  learnerName: string;
  nextHint: string;
};
