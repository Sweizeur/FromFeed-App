/**
 * Hiérarchie des types de cuisine/lieux
 * Quand on filtre par un type parent, on inclut automatiquement tous ses sous-types
 */
export const typeHierarchy: Record<string, string[]> = {
  // Types de cuisine asiatique
  asiatique: ['chinois', 'japonais', 'thaï', 'vietnamien', 'coréen', 'indien', 'indonésien', 'malaisien', 'singapourien'],
  
  // Types de cuisine européenne
  européen: ['français', 'italien', 'espagnol', 'grec', 'allemand', 'portugais', 'britannique'],
  
  // Types de cuisine méditerranéenne
  méditerranéen: ['italien', 'grec', 'espagnol', 'français', 'turc', 'libanais', 'marocain'],
  
  // Types de cuisine du Moyen-Orient
  'moyen-orient': ['turc', 'libanais', 'marocain', 'tunisien', 'algérien', 'kebab'],
  
  // Types de cuisine américaine
  américain: ['américain', 'mexicain', 'tex-mex'],
  
  // Types de restauration rapide
  fastfood: ['snack', 'burger', 'pizza', 'kebab', 'tacos'],
};

/**
 * Vérifie si un type correspond à un filtre, en tenant compte de la hiérarchie
 * @param placeType Le type du lieu
 * @param filterType Le type sélectionné dans le filtre
 * @returns true si le lieu correspond au filtre
 */
export function matchesTypeFilter(placeType: string | null | undefined, filterType: string | null): boolean {
  if (!filterType) return true; // Pas de filtre de type
  if (!placeType) return false; // Le lieu n'a pas de type
  
  // Correspondance exacte
  if (placeType.toLowerCase() === filterType.toLowerCase()) {
    return true;
  }
  
  // Vérifier si le filtre est un type parent qui inclut ce type
  const hierarchy = typeHierarchy[filterType.toLowerCase()];
  if (hierarchy && hierarchy.includes(placeType.toLowerCase())) {
    return true;
  }
  
  // Vérifier si le type du lieu est un parent qui inclut le filtre
  const placeHierarchy = typeHierarchy[placeType.toLowerCase()];
  if (placeHierarchy && placeHierarchy.includes(filterType.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Récupère tous les types enfants d'un type parent
 */
export function getChildTypes(parentType: string): string[] {
  return typeHierarchy[parentType.toLowerCase()] || [];
}

/**
 * Récupère tous les types parents d'un type enfant
 */
export function getParentTypes(childType: string): string[] {
  const parents: string[] = [];
  for (const [parent, children] of Object.entries(typeHierarchy)) {
    if (children.includes(childType.toLowerCase())) {
      parents.push(parent);
    }
  }
  return parents;
}

