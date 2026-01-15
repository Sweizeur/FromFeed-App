const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Plugin Expo pour configurer App Transport Security (ATS)
 * Autorise les connexions HTTP UNIQUEMENT en développement
 * En production, ATS reste strict (HTTPS uniquement)
 */
const withATSConfig = (config) => {
  return withInfoPlist(config, (config) => {
    // Détecter si on est en mode développement
    // En production (build EAS), EAS_BUILD_PROFILE sera 'production' ou 'preview'
    // En développement local ou build dev, on active la config permissive
    const isProductionBuild = 
      process.env.EAS_BUILD_PROFILE === 'production' ||
      process.env.EAS_BUILD_PROFILE === 'preview';
    
    const isDevelopmentBuild = !isProductionBuild;

    if (isDevelopmentBuild) {
      // Configuration permissive UNIQUEMENT pour le développement
      config.modResults.NSAppTransportSecurity = {
        NSAllowsArbitraryLoads: true,
        NSAllowsArbitraryLoadsInWebContent: true,
        NSAllowsArbitraryLoadsForMedia: true,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: true,
            NSExceptionRequiresForwardSecrecy: false
          },
          '192.0.0.2': {
            NSExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: false,
            NSExceptionRequiresForwardSecrecy: false
          }
        }
      };
    } else {
      // En production : ATS strict (HTTPS uniquement)
      // Ne pas définir NSAllowsArbitraryLoads du tout
      // iOS appliquera ATS strictement par défaut (HTTPS uniquement)
      // On peut garder NSAllowsLocalNetworking si nécessaire pour certaines fonctionnalités
      if (!config.modResults.NSAppTransportSecurity) {
        config.modResults.NSAppTransportSecurity = {};
      }
      // S'assurer que NSAllowsArbitraryLoads n'est PAS défini à true
      // En production, toutes les connexions doivent être HTTPS
      delete config.modResults.NSAppTransportSecurity.NSAllowsArbitraryLoads;
      delete config.modResults.NSAppTransportSecurity.NSAllowsArbitraryLoadsInWebContent;
      delete config.modResults.NSAppTransportSecurity.NSAllowsArbitraryLoadsForMedia;
    }

    return config;
  });
};

module.exports = withATSConfig;

