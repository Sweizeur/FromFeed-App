const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Plugin Expo pour gérer les entitlements Push Notifications
 * - Retire l'entitlement en développement local (compte gratuit)
 * - Laisse l'entitlement pour les builds EAS (compte payant)
 */
const withNotificationsEntitlements = (config) => {
  return withEntitlementsPlist(config, (config) => {
    // Détecter si on est en mode développement local
    // En production (build EAS), EAS_BUILD_PROFILE sera défini
    const isProductionBuild = 
      process.env.EAS_BUILD_PROFILE === 'production' ||
      process.env.EAS_BUILD_PROFILE === 'preview' ||
      process.env.EAS_BUILD_PROFILE === 'development';
    
    const isLocalDevelopment = !process.env.EAS_BUILD_PROFILE;

    if (isLocalDevelopment) {
      // En développement local : retirer l'entitlement pour permettre la compilation
      // Les comptes Apple Developer personnels ne supportent pas Push Notifications
      if (config.modResults['aps-environment']) {
        delete config.modResults['aps-environment'];
        console.log('[Notifications Plugin] Entitlement aps-environment retiré pour le développement local');
      }
    } else {
      // En build EAS : s'assurer que l'entitlement est présent
      // Le plugin expo-notifications devrait l'ajouter automatiquement, mais on s'assure qu'il est là
      if (!config.modResults['aps-environment']) {
        config.modResults['aps-environment'] = 'development';
        console.log('[Notifications Plugin] Entitlement aps-environment ajouté pour le build EAS');
      }
    }

    return config;
  });
};

module.exports = withNotificationsEntitlements;
