import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../_layout';

export default function MyPlantsScreen() {
  const router = useRouter();
  const { savedPlants } = useUser();

  const totalPlants = savedPlants.length;
  const needsWater = savedPlants.filter((p) => p.nextWatering.toLowerCase().includes('today')).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>My Plants</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={{ fontSize: 24, color: '#FFFFFF', fontWeight: '600', lineHeight: 26 }}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{totalPlants}</Text>
            <Text style={styles.statLabel}>Total Plants</Text>
          </View>
          <View style={[styles.statCard, styles.statAlertBg]}>
            <Text style={[styles.statNum, styles.statAlertText]}>{needsWater}</Text>
            <Text style={styles.statLabel}>Needs Water</Text>
          </View>
        </View>

        {/* Plant List */}
        <Text style={styles.sectionTitle}>Your Collection</Text>
        {savedPlants.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Image
              source={require('@/assets/images/leaf.png')}
              style={styles.emptyStateIcon}
              contentFit="contain"
            />
            <Text style={styles.emptyStateTitle}>Your collection is empty</Text>
            <Text style={styles.emptyStateSub}>Identify plants and tap save to build your garden! 🌿</Text>
          </View>
        ) : (
          savedPlants.map((plant) => (
            <TouchableOpacity
              key={plant.id}
              style={styles.plantCard}
              onPress={() => router.push({
                pathname: '/plant-details',
                params: {
                  imageUri: plant.imageUri ? encodeURIComponent(plant.imageUri) : '',
                  commonName: plant.name,
                  scientificName: plant.botanicalName,
                  confidence: plant.confidence,
                  plantResult: plant.plantResult,
                }
              })}
            >
              <Image
                source={plant.imageUri ? { uri: plant.imageUri } : require('@/assets/images/leaf.png')}
                style={styles.plantImg}
              />
              <View style={styles.plantDetails}>
                <Text style={styles.plantName}>{plant.name}</Text>
                <Text style={styles.plantBotanical}>{plant.botanicalName}</Text>

                <View style={styles.badgesRow}>
                  <View style={[styles.badge, plant.nextWatering.toLowerCase().includes('today') ? styles.badgeAlert : styles.badgeInfo]}>
                    <Image
                      source={require('@/assets/images/care.png')}
                      style={{ width: 12, height: 12, marginRight: 4 }}
                      tintColor={plant.nextWatering.toLowerCase().includes('today') ? '#C84C4C' : '#498EC5'}
                      contentFit="contain"
                    />
                    <Text style={[styles.badgeText, plant.nextWatering.toLowerCase().includes('today') ? styles.badgeTextAlert : styles.badgeTextInfo]}>
                      {plant.nextWatering}
                    </Text>
                  </View>
                  <View style={[styles.badge, styles.badgeSuccess]}>
                    <Text style={{ fontSize: 11, color: '#4E8C44', marginRight: 4 }}>♥</Text>
                    <Text style={[styles.badgeText, styles.badgeTextSuccess]}>{plant.healthStatus}</Text>
                  </View>
                </View>
              </View>
              <Image
                source={require('@/assets/images/next.png')}
                style={{ width: 16, height: 16 }}
                tintColor="#8CA696"
                contentFit="contain"
              />
            </TouchableOpacity>
          ))
        )}

        {/* Info Banner */}
        <View style={styles.tipCard}>
          <Image
            source={require('@/assets/images/leaf1.png')}
            style={{ width: 24, height: 24, marginRight: 12 }}
            contentFit="contain"
          />
          <View style={styles.tipTextContainer}>
            <Text style={styles.tipTitle}>Tip of the day</Text>
            <Text style={styles.tipDescription}>
              Clean your plant leaves with a damp cloth once a month to help them absorb sunlight better!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5EF',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C3A27',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4E8C44',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4E8C44',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 110, // tab bar offset
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F5EF',
  },
  statAlertBg: {
    backgroundColor: '#FFF2F2',
    borderColor: '#FFE0E0',
  },
  statNum: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C3A27',
  },
  statAlertText: {
    color: '#C84C4C',
  },
  statLabel: {
    fontSize: 12,
    color: '#718E7B',
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C3A27',
    marginBottom: 16,
  },
  plantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F5EF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  plantImg: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 16,
  },
  plantDetails: {
    flex: 1,
  },
  plantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C3A27',
  },
  plantBotanical: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#718E7B',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeInfo: {
    backgroundColor: '#EEF6FC',
  },
  badgeAlert: {
    backgroundColor: '#FFF2F2',
  },
  badgeSuccess: {
    backgroundColor: '#EBF4EA',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeTextInfo: {
    color: '#498EC5',
  },
  badgeTextAlert: {
    color: '#C84C4C',
  },
  badgeTextSuccess: {
    color: '#4E8C44',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#EBF4EA',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  tipIcon: {
    marginRight: 12,
  },
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C3A27',
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 12,
    color: '#2E4C38',
    lineHeight: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0F5EF',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  emptyStateIcon: {
    width: 60,
    height: 60,
    marginBottom: 12,
    opacity: 0.8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C3A27',
  },
  emptyStateSub: {
    fontSize: 11,
    color: '#718E7B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
});
