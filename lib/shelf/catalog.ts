/** Roles we keep ready-made days for (BRIEF shelf). Expand as we batch-build. */
export type ShelfRole = {
  roleKey: string;
  label: string;
  /** Lowercase phrases that map without calling the model. */
  aliases: string[];
};

export const SHELF_ROLES: ShelfRole[] = [
  {
    roleKey: "product-manager",
    label: "Product Manager",
    aliases: [
      "product manager",
      "associate product manager",
      "junior product manager",
      "pm ",
      " product management",
    ],
  },
  {
    roleKey: "customer-support-executive",
    label: "Customer Support Executive",
    aliases: [
      "customer support",
      "customer service",
      "support executive",
      "support agent",
      "cx executive",
    ],
  },
  {
    roleKey: "retail-store-manager",
    label: "Retail Store Manager",
    aliases: [
      "retail store manager",
      "store manager",
      "shop manager",
      "retail manager",
    ],
  },
  {
    roleKey: "social-media-marketing-executive",
    label: "Social Media Marketing Executive",
    aliases: [
      "social media",
      "social media marketing",
      "smm ",
      "content marketing executive",
    ],
  },
];

export function labelForRoleKey(roleKey: string): string {
  return SHELF_ROLES.find((r) => r.roleKey === roleKey)?.label || roleKey;
}

/** Deterministic match from a screened role title → shelf role_key or null. */
export function matchRoleKeyByAlias(roleTitle: string): string | null {
  const t = ` ${roleTitle.toLowerCase().trim()} `;
  for (const role of SHELF_ROLES) {
    for (const a of role.aliases) {
      if (t.includes(a.toLowerCase())) return role.roleKey;
    }
  }
  return null;
}
