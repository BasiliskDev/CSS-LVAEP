/**
 * The achievements checklist, transcribed verbatim from the LVA Essex/Passaic
 * "Student Monthly Attendance & Achievement Form".
 *
 * This lives in code rather than the database so the checklist renders for a student
 * with zero saved rows, and so revising the form needs no migration. Only *state*
 * (attained / date / note) is persisted, keyed by `code`.
 *
 * `core: true` marks the items the form prints with a leading asterisk — the
 * federally reportable outcomes.
 */

export type AchievementItem = {
  code: string;
  number: number;
  label: string;
  core: boolean;
};

export type AchievementGroup = {
  key: string;
  letter: string;
  title: string;
  items: AchievementItem[];
};

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  {
    key: "A",
    letter: "A",
    title: "Economic",
    items: [
      { code: "A1", number: 1, label: "Enter Employment", core: true },
      { code: "A2", number: 2, label: "Retain Employment", core: true },
      { code: "A3", number: 3, label: "Leave public assistance", core: false },
    ],
  },
  {
    key: "B",
    letter: "B",
    title: "Educational",
    items: [
      {
        code: "B1",
        number: 1,
        label: "Achieve work-based project learner goal",
        core: false,
      },
      {
        code: "B2",
        number: 2,
        label: "Enter Occupational Skills Training Program",
        core: true,
      },
      { code: "B3", number: 3, label: "Enter Postsecondary Education", core: true },
      { code: "B4", number: 4, label: "Obtain High School Diploma", core: true },
    ],
  },
  {
    key: "C",
    letter: "C",
    title: "Family",
    items: [
      { code: "C1", number: 1, label: "Help more frequently with school", core: false },
      {
        code: "C2",
        number: 2,
        label: "Increase contact with child(ren)'s teachers",
        core: false,
      },
      {
        code: "C3",
        number: 3,
        label: "More involvement in child(ren)'s school activities",
        core: false,
      },
      { code: "C4", number: 4, label: "Purchase books or magazines", core: false },
      { code: "C5", number: 5, label: "Read to child(ren)", core: false },
      {
        code: "C6",
        number: 6,
        label: "Visit the library (with/for child(ren))",
        core: false,
      },
    ],
  },
  {
    key: "D",
    letter: "D",
    title: "Societal/Community",
    items: [
      { code: "D1", number: 1, label: "Obtain citizenship", core: true },
      { code: "D2", number: 2, label: "Achieve civics skills", core: false },
      {
        code: "D3",
        number: 3,
        label: "Increase involvement in community activities",
        core: false,
      },
      { code: "D4", number: 4, label: "Vote or register to vote", core: false },
    ],
  },
];

/** Custom "E. Other(s)" rows are stored as E1, E2, ... with their own label. */
export const CUSTOM_ACHIEVEMENT_PREFIX = "E";

export const CATALOG_BY_CODE: Map<string, AchievementItem> = new Map(
  ACHIEVEMENT_GROUPS.flatMap((g) => g.items).map((item) => [item.code, item]),
);

export function isCustomCode(code: string): boolean {
  return code.startsWith(CUSTOM_ACHIEVEMENT_PREFIX);
}

/** Display label for a stored row: catalog label for A1-D4, own label for E rows. */
export function labelForCode(code: string, storedLabel?: string | null): string {
  return CATALOG_BY_CODE.get(code)?.label ?? storedLabel ?? code;
}

/** Next free custom code given the codes a student already has. */
export function nextCustomCode(existingCodes: string[]): string {
  const used = existingCodes
    .filter(isCustomCode)
    .map((c) => Number.parseInt(c.slice(1), 10))
    .filter((n) => Number.isFinite(n));
  return `${CUSTOM_ACHIEVEMENT_PREFIX}${(used.length ? Math.max(...used) : 0) + 1}`;
}

export const CORE_CODES: string[] = ACHIEVEMENT_GROUPS.flatMap((g) =>
  g.items.filter((i) => i.core).map((i) => i.code),
);
