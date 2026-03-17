/**
 * Hiérarchie des types de cuisine/lieux
 * Quand on filtre par un type parent, on inclut automatiquement tous ses sous-types
 */
export const typeHierarchy: Record<string, string[]> = {
  asiatique: ['chinois', 'japonais', 'thaï', 'vietnamien', 'coréen', 'indien', 'indonésien', 'malaisien', 'singapourien'],
  européen: ['français', 'italien', 'espagnol', 'grec', 'allemand', 'portugais', 'britannique'],
  méditerranéen: ['italien', 'grec', 'espagnol', 'français', 'turc', 'libanais', 'marocain'],
  'moyen-orient': ['turc', 'libanais', 'marocain', 'tunisien', 'algérien', 'kebab'],
  américain: ['américain', 'mexicain', 'tex-mex'],
  fastfood: ['snack', 'burger', 'pizza', 'kebab', 'tacos'],
};

/**
 * Vérifie si un type correspond à un filtre, en tenant compte de la hiérarchie
 * @param placeType Le type du lieu
 * @param filterType Le type sélectionné dans le filtre
 * @returns true si le lieu correspond au filtre
 */
export function matchesTypeFilter(placeType: string | null | undefined, filterType: string | null): boolean {
  if (!filterType) return true;
  if (!placeType) return false;
  
  if (placeType.toLowerCase() === filterType.toLowerCase()) {
    return true;
  }
  
  const hierarchy = typeHierarchy[filterType.toLowerCase()];
  if (hierarchy && hierarchy.includes(placeType.toLowerCase())) {
    return true;
  }
  
  const placeHierarchy = typeHierarchy[placeType.toLowerCase()];
  if (placeHierarchy && placeHierarchy.includes(filterType.toLowerCase())) {
    return true;
  }
  
  return false;
}