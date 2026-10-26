// Pure identity search for the compose sender picker.

/**
 * Keep identities whose name, email, and label contain every query term.
 * @param {{ id: string, name: string, email: string, label: string }[]} identities
 * @param {string} query
 * @returns {{ id: string, name: string, email: string, label: string }[]}
 */
export function filterIdentities(identities, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return identities;

  return identities.filter((identity) => {
    const searchable = `${identity.name} ${identity.email} ${identity.label}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
