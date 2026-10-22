import { listTracks, loadTrack } from "./load";

export type CatalogTrack = {
  id: string;
  title: string;
  role: string;
  companyName: string;
  oneLiner: string;
  dayCount: number;
};

/** Public catalog cards — safe to show on the homepage. */
export function getCatalogTracks(): CatalogTrack[] {
  return listTracks()
    .map((id) => {
      try {
        const track = loadTrack(id);
        return {
          id: track.id,
          title: track.title,
          role: track.role,
          companyName: track.company.name,
          oneLiner: track.company.one_liner,
          dayCount: track.days.length,
        };
      } catch {
        return null;
      }
    })
    .filter((t): t is CatalogTrack => Boolean(t))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getCatalogTrack(trackId: string): CatalogTrack | null {
  try {
    const track = loadTrack(trackId);
    return {
      id: track.id,
      title: track.title,
      role: track.role,
      companyName: track.company.name,
      oneLiner: track.company.one_liner,
      dayCount: track.days.length,
    };
  } catch {
    return null;
  }
}
