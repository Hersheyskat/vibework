export type PublicGame = {
  gameId: string;
  runId: string;
  level: string;
  status: string;
  clock: string;
  view: string;
  next: { message: string; view: string };
  toast: string | null;
  company: { name: string; one_liner: string };
  role: string;
  title: string;
  theme: string;
  practised: string[];
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
  }[];
  threads: Record<
    string,
    { from: string; text: string; returned_data?: boolean }[]
  >;
  drafts: Record<string, string>;
  unread: Record<string, number>;
  support: {
    assist: { id: string; name: string; role: string; unread: number };
    mentor: { id: string; name: string; role: string; unread: number };
  };
};
