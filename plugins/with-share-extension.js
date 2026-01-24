const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Plugin Expo pour configurer l'app comme cible de partage
 * Permet à FromFeed d'apparaître dans le share sheet iOS/Android
 * 
 * NOTE: Pour iOS, une Share Extension native complète serait nécessaire
 * pour vraiment apparaître dans le share sheet. Cette configuration permet
 * au moins de recevoir les URLs partagées via deep links.
 */
const withShareExtension = (config) => {
  // Configuration iOS
  config = withInfoPlist(config, (config) => {
    // Ajouter les types de documents que l'app peut recevoir
    // Cela permet à l'app d'apparaître dans le share sheet pour les URLs
    if (!config.modResults.NSUserActivityTypes) {
      config.modResults.NSUserActivityTypes = [];
    }
    
    // Ajouter les types d'URL que l'app peut gérer
    // TikTok et Instagram URLs
    if (!config.modResults.CFBundleURLTypes) {
      config.modResults.CFBundleURLTypes = [];
    }
    
    // S'assurer que notre scheme est présent
    const existingScheme = config.modResults.CFBundleURLTypes.find(
      (type) => type.CFBundleURLSchemes?.includes('com.fromfeed.app')
    );
    
    if (!existingScheme) {
      config.modResults.CFBundleURLTypes.push({
        CFBundleTypeRole: 'Editor',
        CFBundleURLName: 'com.fromfeed.app',
        CFBundleURLSchemes: ['com.fromfeed.app'],
      });
    }

    // Ajouter les types de documents pour le share sheet
    // Cela permet à l'app de recevoir des URLs partagées
    if (!config.modResults.CFBundleDocumentTypes) {
      config.modResults.CFBundleDocumentTypes = [];
    }

    // Ajouter un type de document pour les URLs
    const existingUrlType = config.modResults.CFBundleDocumentTypes.find(
      (type) => type.CFBundleTypeName === 'URL'
    );

    if (!existingUrlType) {
      config.modResults.CFBundleDocumentTypes.push({
        CFBundleTypeName: 'URL',
        CFBundleTypeRole: 'Editor',
        LSItemContentTypes: ['public.url', 'public.text'],
      });
    }

    return config;
  });

  // Configuration Android
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    
    if (!manifest.application) {
      manifest.application = [{}];
    }
    
    const application = manifest.application[0];
    
    if (!application.activity) {
      application.activity = [];
    }

    // Chercher l'activity principale
    let mainActivity = application.activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (!mainActivity) {
      mainActivity = {
        $: {
          'android:name': '.MainActivity',
          'android:exported': 'true',
        },
        'intent-filter': [],
      };
      application.activity.push(mainActivity);
    }

    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    // Ajouter un intent-filter pour recevoir les URLs partagées
    const shareIntentFilter = {
      action: [
        {
          $: {
            'android:name': 'android.intent.action.SEND',
          },
        },
      ],
      category: [
        {
          $: {
            'android:name': 'android.intent.category.DEFAULT',
          },
        },
      ],
      data: [
        {
          $: {
            'android:mimeType': 'text/plain',
          },
        },
      ],
    };

    // Vérifier si l'intent-filter existe déjà
    const existingShareFilter = mainActivity['intent-filter'].find(
      (filter) => filter.action?.[0]?.['$']?.['android:name'] === 'android.intent.action.SEND'
    );

    if (!existingShareFilter) {
      mainActivity['intent-filter'].push(shareIntentFilter);
    }

    return config;
  });

  return config;
};

module.exports = withShareExtension;
