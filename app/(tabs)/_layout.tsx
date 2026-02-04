import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

/**
 * Barre d'onglets native iOS (UITabBarController) / Android.
 * Utilise les composants système natifs, pas un style simulé.
 * @see https://docs.expo.dev/router/advanced/native-tabs/
 */
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="search">
        <Icon sf="magnifyingglass" />
        <Label>Feed</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <Icon sf="map.fill" />
        <Label>Ma Carte</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="collections">
        <Icon sf="folder.fill" />
        <Label>Bibliothèque</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf="gearshape.fill" />
        <Label>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
