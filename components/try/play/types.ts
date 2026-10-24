export type PracticeFeedbackPublic = {
  verdict: string;
  scores: { skill: string; score: number; evidence: string }[];
  strengths: string[];
  improve: string[];
  tasks: { task: string; gap: string }[];
  senior: string;
  missed: string[];
  drill: string;
  total: number;
  practiceLabel: string;
};

export type PublicGame = {
  gameId: string;
  runId: string;
  level: string;
  status: string;
  dayOver: boolean;
  clock: string;
  view: string;
  next: { message: string; view: string };
  toast: string | null;
  company: { name: string; one_liner: string };
  role: string;
  title: string;
  theme: string;
  practised: string[];
  skills: { id: string; name: string; description: string }[];
  public: {
    inbox: {
      from?: string;
      time?: string;
      subject?: string;
      body?: string;
    }[];
    dashboard: {
      title?: string;
      subtitle?: string;
      columns?: string[];
      rows?: { cells?: string[]; miss?: boolean }[];
      notes?: string[];
    };
    reviews: { text?: string; meta?: string }[];
    documents: { title?: string; body?: string }[];
  };
  mentor: { name: string; title: string };
  characters: {
    id: string;
    name: string;
    role: string;
    cares_about: string;
    color: string;
    initials: string;
    available: boolean;
    locked: boolean;
    isBoss: boolean;
    isInfoSource: boolean;
    dataPulls?: number;
    dataPullLimit?: number;
    chatLocked: boolean;
    unread: number;
  }[];
  tasks: {
    id: string;
    title: string;
    minutes?: number;
    kind: string;
    description?: string;
    submit_to?: string;
    hint?: string;
    done: boolean;
    submitted: boolean;
    submission: string | null;
    revisions: number;
    canRevise: boolean;
    revising: boolean;
    draft: string;
    expectedAnswer?: string;
  }[];
  threads: Record<
    string,
    {
      from: string;
      text: string;
      returned_data?: boolean;
      imgs?: string[];
    }[]
  >;
  drafts: Record<string, string>;
  unread: Record<string, number>;
  support: {
    assist: { id: string; name: string; role: string; unread: number };
    mentor: { id: string; name: string; role: string; unread: number };
  };
  feedback: PracticeFeedbackPublic | null;
  learning: {
    skill: string;
    items: {
      type: string;
      title: string;
      by: string;
      why: string;
      search: string;
    }[];
  }[];
  drill: string | null;
  seniorView: string | null;
};
