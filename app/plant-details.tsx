import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Dimensions, Share, Animated, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useUser } from './_layout';
import { getDatabase } from '@/database/sqlite';
import { plantRepository } from '@/repositories/plantRepository';
import { SQLitePlant } from '@/types/plant';
import { resolveLocalUri, getResolvedImageSource } from '@/services/uriHelper';

const { width } = Dimensions.get('window');

function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\*/g, '');
}

const PERENUAL_API_KEY = process.env.EXPO_PUBLIC_PERENUAL_API_KEY || process.env.PERENUAL_API_KEY || 'sk-whtl6a4bf6c64d66918621';

const getWaterDetails = (watering?: string) => {
  if (!watering) return null;
  const w = watering.toLowerCase();
  if (w.includes('frequent') || w.includes('high')) {
    return { title: 'Frequent', desc: 'Keep soil moist consistently' };
  }
  if (w.includes('minimum') || w.includes('low') || w.includes('dry')) {
    return { title: 'Minimum', desc: 'Allow soil to dry out completely' };
  }
  if (w.includes('average') || w.includes('medium') || w.includes('moderate')) {
    return { title: 'Average', desc: 'Water when topsoil feels dry' };
  }
  return { title: watering, desc: 'Check soil moisture before watering' };
};

const getLightDetails = (sunlightStr?: string) => {
  if (!sunlightStr) return null;
  try {
    const list = JSON.parse(sunlightStr) as string[];
    if (!list || list.length === 0) return null;
    const title = list.join(', ');
    const listLower = list.map(s => s.toLowerCase());
    
    if (listLower.some(s => s.includes('full sun')) && !listLower.some(s => s.includes('part shade') || s.includes('indirect') || s.includes('shade'))) {
      return { title, desc: 'Thrives in direct sunlight' };
    }
    if (listLower.some(s => s.includes('shade') || s.includes('low light'))) {
      return { title, desc: 'Prefers shade/low light' };
    }
    return { title, desc: 'Avoid harsh direct sun' };
  } catch (e) {
    return null;
  }
};

const getTempDetails = (plant?: SQLitePlant | null) => {
  if (!plant) return { title: '18°C - 25°C', desc: 'Standard room temperature' };
  const lowerCommon = (plant.common_name || '').toLowerCase();
  const isSucculent = lowerCommon.includes('cactus') || lowerCommon.includes('succulent') || lowerCommon.includes('aloe') || plant.drought_tolerant === 1;
  const isIndoor = plant.indoor === 1;

  if (isSucculent) {
    return { title: '20°C - 30°C', desc: 'Warm temperature lover' };
  }
  if (isIndoor) {
    return { title: '18°C - 24°C', desc: 'Standard room temperature' };
  }
  return { title: '10°C - 25°C', desc: 'Tolerates cooler drafts' };
};

const getAgeDetails = (plant?: SQLitePlant | null) => {
  if (!plant) return { title: '5 - 15 Years', desc: 'Multi-year growing cycle' };
  const cycleLower = (plant.cycle || '').toLowerCase();
  const familyLower = (plant.family || '').toLowerCase();
  const nameLower = (plant.common_name || '').toLowerCase();
  const isTree = familyLower.includes('sapindaceae') || nameLower.includes('maple') || nameLower.includes('tree') || nameLower.includes('oak') || nameLower.includes('willow') || nameLower.includes('fir');

  if (cycleLower.includes('annual')) {
    return { title: '1 Year', desc: 'Completes life cycle in one season' };
  }
  if (isTree) {
    return { title: '50+ Years', desc: 'Very long-lived outdoor tree' };
  }
  if (plant.indoor === 1) {
    return { title: '5 - 15 Years', desc: 'Long-lasting houseplant' };
  }
  return { title: '3 - 10 Years', desc: 'Multi-year growing cycle' };
};

const getPlantTip = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('snake')) {
    return "Snake Plant is one of the best air purifiers and releases oxygen at night. Perfect for your bedroom!";
  }
  if (lower.includes('aloe')) {
    return "Aloe Vera gel can be used to soothe burns and cuts. Keep it in a bright spot near your kitchen!";
  }
  if (lower.includes('monstera')) {
    return "Monstera leaves love moderate humidity. Wipe them with a damp cloth to help them photosynthesize!";
  }
  if (lower.includes('rose')) {
    return "Prune roses in early spring to encourage fresh blooms and maintain shape.";
  }
  return `${name} thrives in consistent conditions. Keep it away from dry heating vents and drafty windows.`;
};

export default function PlantDetailsScreen() {
  const router = useRouter();
  const { 
    imageUri: rawImageUri, 
    fromFlow,
    commonName = 'Snake Plant',
    scientificName = 'Sansevieria trifasciata',
    confidence = '96.2',
    plantResult
  } = useLocalSearchParams<{ 
    imageUri?: string; 
    fromFlow?: string;
    commonName?: string;
    scientificName?: string;
    confidence?: string;
    plantResult?: string;
  }>();

  const imageUri = rawImageUri ? decodeURIComponent(rawImageUri) : undefined;

  const [activeTab, setActiveTab] = useState('Overview');
  const { savedPlants, savePlant, removePlant, addRecentScan } = useUser();

  const isAlreadySaved = savedPlants.some((p) => p.name === commonName);
  const [isSaved, setIsSaved] = useState(isAlreadySaved);

  // Extract details from plantResult
  let otherNames = '';
  if (plantResult) {
    try {
      const parsed = JSON.parse(plantResult);
      const match = parsed.results?.[0];
      const names = match?.species?.commonNames;
      if (names && names.length > 1) {
        otherNames = `Also called ${names.slice(1, 4).join(', ')}`;
      }
    } catch (e) {
      console.warn(e);
    }
  }
  if (!otherNames) {
    otherNames = commonName === 'Snake Plant' ? "Also called Mother-in-law's Tongue" : `Identification match score: ${confidence}%`;
  }

  // Find a matching stock image from our category dataset if available
  const getStockImage = (name: string) => {
    const lowerName = name.toLowerCase();
    const matches: Record<string, string> = {
      'snake plant': 'https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?q=80&w=500&auto=format&fit=crop',
      'peace lily': 'https://images.unsplash.com/photo-1593696140826-c58b021acf8b?q=80&w=500&auto=format&fit=crop',
      'monstera': 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=500&auto=format&fit=crop',
      'pothos': 'https://images.unsplash.com/photo-1596436889106-be35e843f974?q=80&w=500&auto=format&fit=crop',
      'aloe vera': 'https://images.unsplash.com/photo-1596547610051-fb1fbe7556f8?q=80&w=500&auto=format&fit=crop',
      'jade plant': 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=80&w=500&auto=format&fit=crop',
      'zebra': 'https://images.unsplash.com/photo-1508849789987-4e5333c12b78?q=80&w=500&auto=format&fit=crop',
      'cactus': 'https://images.unsplash.com/photo-1508849789987-4e5333c12b78?q=80&w=500&auto=format&fit=crop',
      'rose': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=500&auto=format&fit=crop',
      'orchid': 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?q=80&w=500&auto=format&fit=crop',
      'lavender': 'https://images.unsplash.com/photo-1528826722805-8b18a5104c38?q=80&w=500&auto=format&fit=crop',
      'tulsi': 'https://images.unsplash.com/photo-1578159812516-e5c6a1e80931?q=80&w=500&auto=format&fit=crop',
      'basil': 'https://images.unsplash.com/photo-1578159812516-e5c6a1e80931?q=80&w=500&auto=format&fit=crop',
      'mint': 'https://images.unsplash.com/photo-1532704100644-55d379f5176c?q=80&w=500&auto=format&fit=crop',
      'rosemary': 'https://images.unsplash.com/photo-1594313525287-f83196f73a38?q=80&w=500&auto=format&fit=crop',
      'fiddle': 'https://images.unsplash.com/photo-1597055181300-e3633a207518?q=80&w=500&auto=format&fit=crop',
      'fig': 'https://images.unsplash.com/photo-1597055181300-e3633a207518?q=80&w=500&auto=format&fit=crop',
      'bonsai': 'https://images.unsplash.com/photo-1512428813833-df70f77a6b6c?q=80&w=500&auto=format&fit=crop',
      'maple': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?q=80&w=500&auto=format&fit=crop',
    };

    for (const key of Object.keys(matches)) {
      if (lowerName.includes(key)) {
        return matches[key];
      }
    }
    return null;
  };

  const [sqliteDetail, setSqliteDetail] = useState<SQLitePlant | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(-120)).current;

  const waterData = getWaterDetails(sqliteDetail?.watering);
  const lightData = getLightDetails(sqliteDetail?.sunlight);
  const tempData = getTempDetails(sqliteDetail);
  const ageData = getAgeDetails(sqliteDetail);
  const dynamicTabs = sqliteDetail ? ['Overview', 'Care Guide', 'Health', 'About', 'Similar'] : ['Overview'];

  // Retrieve detailed metadata from SQLite or Perenual API
  useEffect(() => {
    const fetchExtraDetails = async () => {
      try {
        const db = await getDatabase();
        // 1. Check if we already have it locally
        let row = await db.getFirstAsync<SQLitePlant>(
          'SELECT * FROM Plants WHERE common_name = ? OR scientific_name = ?',
          [commonName, scientificName]
        );

        // 2. If not found locally, construct a detailed local record using PlantNet identification data
        if (!row) {
          try {
            const normalizedCommon = commonName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            const mapped: SQLitePlant = {
              id: Date.now() + Math.floor(Math.random() * 1000),
              common_name: normalizedCommon,
              scientific_name: scientificName,
              family: 'Plantaceae',
              genus: scientificName.split(' ')[0] || 'Genus',
              cycle: 'Perennial',
              watering: 'Average',
              sunlight: JSON.stringify(["Part shade", "Indirect light"]),
              indoor: 1,
              poisonous_to_humans: 0,
              poisonous_to_pets: 0,
              care_level: 'Medium',
              growth_rate: 'Regular',
              drought_tolerant: 0,
              salt_tolerant: 0,
              medicinal: 0,
              edible: 0,
              description: `A beautiful and unique plant specimen of ${normalizedCommon} (${scientificName}). Highly appreciated for its foliage and ornamental value.`,
              image_url: imageUri || '',
              thumbnail_url: imageUri || '',
            };
            
            await plantRepository.savePlant(mapped);
            row = mapped;
          } catch (genErr) {
            console.warn('Failed to generate local plant details:', genErr);
          }
        }

        let finalImageUri = imageUri || null;
        if (row) {
          const fixedRow = {
            ...row,
            image_url: resolveLocalUri(row.image_url) || row.image_url,
            thumbnail_url: resolveLocalUri(row.thumbnail_url) || row.thumbnail_url,
          };
          setSqliteDetail(fixedRow);
          // If we don't have a user uploaded image, use the official database image
          if (!finalImageUri && fixedRow.image_url) {
            finalImageUri = fixedRow.image_url;
          }
        }

        // Add to recent scans using the official image URI
        addRecentScan({
          id: String(Date.now()),
          name: commonName,
          botanicalName: scientificName,
          time: 'Just now',
          emoji: '🌿',
          bgColor: '#E2F0DE',
          imageUri: finalImageUri,
          confidence: confidence,
          plantResult: plantResult || null,
        });
      } catch (err) {
        console.warn('Error reading SQLite details:', err);
      }
    };
    
    fetchExtraDetails();
  }, [commonName, scientificName, imageUri, confidence, plantResult]);

  const triggerToast = () => {
    setShowToast(true);
    Animated.spring(toastAnim, {
      toValue: Platform.OS === 'ios' ? 60 : 30,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();

    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setShowToast(false);
      });
    }, 2500);
  };

  const handleSaveToggle = () => {
    if (!isSaved) {
      savePlant({
        id: String(Date.now()),
        name: commonName,
        botanicalName: scientificName,
        imageUri: imageUri || sqliteDetail?.image_url || 'https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?q=80&w=300&auto=format&fit=crop',
        nextWatering: 'In 3 days',
        healthStatus: 'Excellent',
        confidence: confidence,
        plantResult: plantResult || null,
      });
      setIsSaved(true);
      triggerToast();
    } else {
      const plantToRemove = savedPlants.find((p) => p.name === commonName);
      if (plantToRemove) {
        removePlant(plantToRemove.id);
      }
      setIsSaved(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out the ${commonName} on Plantify! ${confidence}% Match!`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {showToast && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
          <Image
            source={require('@/assets/images/leaf1.png')}
            style={styles.toastIcon}
            contentFit="contain"
          />
          <Text style={styles.toastText}>{commonName} added to My Plants! 🌿</Text>
        </Animated.View>
      )}

      {/* Top Navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity 
          style={styles.headerBtn} 
          onPress={() => {
            router.back();
          }}
        >
          <Image
            source={require('@/assets/images/next.png')}
            style={{ width: 20, height: 20, transform: [{ rotate: '180deg' }] }}
            tintColor="#1C3A27"
            contentFit="contain"
          />
        </TouchableOpacity>
        <View style={styles.rightHeaderActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C3A27' }}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1C3A27', letterSpacing: 1 }}>•••</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Plant Hero Section */}
         <View style={styles.heroSection}>
           <Image 
             source={getResolvedImageSource(imageUri || sqliteDetail?.image_url, commonName, !!imageUri)} 
             style={styles.heroImg}
           />
          {/* Match Score Badge */}
          <View style={styles.matchBadge}>
            <Image
              source={require('@/assets/images/secure.png')}
              style={{ width: 14, height: 14 }}
              tintColor="#4E8C44"
              contentFit="contain"
            />
            <Text style={styles.matchText}>{confidence}% Match</Text>
          </View>
          {/* Slide Indicator */}
          <View style={styles.slideIndicator}>
            <Text style={styles.slideText}>1/5</Text>
          </View>
        </View>

        {/* Identity Details */}
        <View style={styles.identityContainer}>
          <Text style={styles.plantName}>{commonName}</Text>
          <Text style={styles.botanicalName}>{scientificName}</Text>
          
          <View style={styles.commonNameRow}>
            <Image
              source={require('@/assets/images/leaf.png')}
              style={{ width: 14, height: 14, marginRight: 6 }}
              contentFit="contain"
            />
            <Text style={styles.commonNameText}>{otherNames}</Text>
          </View>

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.badgeItem}>
              <Image
                source={
                  sqliteDetail && sqliteDetail.indoor === 0
                    ? require('@/assets/images/tree.png')
                    : require('@/assets/images/indoor.png')
                }
                style={{ width: 14, height: 14, marginRight: 4 }}
                contentFit="contain"
              />
              <Text style={styles.badgeText}>
                {sqliteDetail && sqliteDetail.indoor === 0 ? 'Outdoor Plant' : 'Indoor Plant'}
              </Text>
            </View>
            <View style={styles.badgeItem}>
              <Image
                source={require('@/assets/images/sun.png')}
                style={{ width: 14, height: 14, marginRight: 4 }}
                contentFit="contain"
              />
              <Text style={styles.badgeText}>
                {sqliteDetail ? `${sqliteDetail.care_level} Care` : 'Easy Care'}
              </Text>
            </View>
          </View>
        </View>

        {/* Custom Tab Switcher */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsContainer}
        >
          {dynamicTabs.map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab Content (Overview is active) */}
        {activeTab === 'Overview' && (
          <View style={styles.overviewContainer}>
            {/* Description Card */}
            <View style={styles.descRow}>
              <View style={styles.descLeft}>
                <Text numberOfLines={descExpanded ? undefined : 3} style={styles.descText}>
                  {cleanText(sqliteDetail?.description) || 'A resilient and beautiful plant known for its striking foliage and easy-to-care nature. Perfect for adding a fresh green aesthetic to any space.'}
                </Text>
                <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} style={styles.readMoreBtn}>
                  <Text style={styles.readMoreText}>{descExpanded ? 'Read less ⌃' : 'Read more ⌵'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.descRight}>
                <View style={styles.specItem}>
                  <View style={styles.specIconRow}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>🌐</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.specLabel}>Native</Text>
                      <Text style={styles.specValue} numberOfLines={1}>
                        {sqliteDetail?.family || 'Tropical'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.specItem, { marginTop: 14 }]}>
                  <View style={styles.specIconRow}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>📈</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.specLabel}>Growth</Text>
                      <Text style={styles.specValue} numberOfLines={1}>
                        {sqliteDetail?.growth_rate || 'Slow'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Care Guide Cards Grid */}
            {sqliteDetail && (waterData || lightData || tempData || ageData) && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Care Guide</Text>
                  <TouchableOpacity 
                    style={styles.calendarLinkRow}
                    onPress={() => router.push({
                      pathname: '/care-reminder',
                      params: { plantName: commonName }
                    })}
                  >
                    <Text style={styles.calendarLinkText}>View calendar</Text>
                    <Text style={{ fontSize: 12 }}>📅</Text>
                    <Image source={require('@/assets/images/next.png')} style={{ width: 8, height: 8, marginLeft: 2 }} tintColor="#7DA676" contentFit="contain" />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.careScrollContent}
                  style={{ marginBottom: 20 }}
                >
                  {/* Water Card */}
                  {waterData && (
                    <View style={[styles.careCard, styles.waterCard]}>
                      <View style={[styles.careIconBg, styles.waterIconBg]}>
                        <Text style={{ fontSize: 16 }}>💧</Text>
                      </View>
                      <Text style={styles.careCardTitle}>Water</Text>
                      <Text style={styles.careCardDesc}>{waterData.title}</Text>
                      <Text style={styles.careCardDetails}>{waterData.desc}</Text>
                    </View>
                  )}

                  {/* Light Card */}
                  {lightData && (
                    <View style={[styles.careCard, styles.lightCard]}>
                      <View style={[styles.careIconBg, styles.lightIconBg]}>
                        <Image
                          source={require('@/assets/images/sun.png')}
                          style={{ width: 18, height: 18 }}
                          contentFit="contain"
                        />
                      </View>
                      <Text style={styles.careCardTitle}>Light</Text>
                      <Text style={styles.careCardDesc} numberOfLines={1}>
                        {lightData.title}
                      </Text>
                      <Text style={styles.careCardDetails}>{lightData.desc}</Text>
                    </View>
                  )}

                  {/* Temperature Card */}
                  {tempData && (
                    <View style={[styles.careCard, styles.tempCard]}>
                      <View style={[styles.careIconBg, styles.tempIconBg]}>
                        <Text style={{ fontSize: 16 }}>🌡️</Text>
                      </View>
                      <Text style={styles.careCardTitle}>Temperature</Text>
                      <Text style={styles.careCardDesc}>{tempData.title}</Text>
                      <Text style={styles.careCardDetails}>{tempData.desc}</Text>
                    </View>
                  )}

                  {/* Lifespan Age Card */}
                  {ageData && (
                    <View style={[styles.careCard, styles.humidityCard]}>
                      <View style={[styles.careIconBg, styles.humidityIconBg]}>
                        <Text style={{ fontSize: 16 }}>⏳</Text>
                      </View>
                      <Text style={styles.careCardTitle}>Lifespan</Text>
                      <Text style={styles.careCardDesc}>{ageData.title}</Text>
                      <Text style={styles.careCardDetails}>{ageData.desc}</Text>
                    </View>
                  )}
                </ScrollView>
              </>
            )}

            {/* Plant Tip Section */}
            <TouchableOpacity 
              activeOpacity={0.85}
              onPress={() => router.push({
                pathname: '/care-reminder',
                params: { plantName: commonName }
              })}
              style={styles.plantTipBanner}
            >
              <Text style={{ fontSize: 24, marginRight: 12 }}>🪴</Text>
              <View style={styles.tipTextCol}>
                <Text style={styles.tipBannerTitle}>Plant Tip</Text>
                <Text style={styles.tipBannerDesc}>
                  {getPlantTip(commonName)}
                </Text>
              </View>
              <Image source={require('@/assets/images/next.png')} style={{ width: 12, height: 12, alignSelf: 'center', marginLeft: 8 }} tintColor="#7DA676" contentFit="contain" />
            </TouchableOpacity>

            {/* Is It Pet Friendly Card */}
            {sqliteDetail && (sqliteDetail.poisonous_to_pets !== null || sqliteDetail.poisonous_to_humans !== null) && (
              <View style={[styles.petCard, sqliteDetail.poisonous_to_pets === 1 ? styles.petCardToxic : styles.petCardSafe]}>
                <View style={styles.petCardContent}>
                  <Text style={{ fontSize: 22, marginRight: 10 }}>{sqliteDetail.poisonous_to_pets === 1 ? '⚠️' : '🛡️'}</Text>
                  <View style={styles.petTextCol}>
                    <Text style={[styles.petTitle, sqliteDetail.poisonous_to_pets === 1 ? styles.petTitleToxic : styles.petTitleSafe]}>
                      Is it pet friendly?
                    </Text>
                    <Text style={[styles.petDesc, sqliteDetail.poisonous_to_pets === 1 ? styles.petDescToxic : styles.petDescSafe]}>
                      {sqliteDetail.poisonous_to_pets === 1 
                        ? 'Toxic to pets if ingested. Keep away from cats and dogs.' 
                        : 'Non-toxic. Perfectly safe for dogs, cats, and humans.'}
                    </Text>
                  </View>
                </View>
                <View style={styles.petGraphicContainer}>
                  <Text style={{ fontSize: 22, marginRight: 6 }}>🐶🐱</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.learnMoreBtn, sqliteDetail.poisonous_to_pets === 1 ? styles.learnMoreBtnToxic : styles.learnMoreBtnSafe]}
                  activeOpacity={0.8}
                  onPress={() => Alert.alert('Pet Toxicity Check', sqliteDetail.poisonous_to_pets === 1 
                    ? 'Always research your specific plant species to ensure pet compatibility. Keep toxic plants elevated out of pet reach.'
                    : 'This plant is generally considered safe, but monitor your pets to prevent minor digestive issues if ingested.')}
                >
                  <Text style={[styles.learnMoreText, sqliteDetail.poisonous_to_pets === 1 ? styles.learnMoreTextToxic : styles.learnMoreTextSafe]}>
                    Learn more
                  </Text>
                  <Image 
                    source={require('@/assets/images/next.png')} 
                    style={{ width: 8, height: 8, marginLeft: 2 }} 
                    tintColor={sqliteDetail.poisonous_to_pets === 1 ? '#C84C4C' : '#4E8C44'} 
                    contentFit="contain" 
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Tab Content (Care Guide active) */}
        {activeTab === 'Care Guide' && (
          <View style={styles.overviewContainer}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>💦 Watering Schedule</Text>
              <Text style={styles.detailSectionText}>
                {cleanText(`This plant requires ${sqliteDetail?.watering || 'average'} watering. Make sure the top soil has dried out slightly before watering again to prevent root rot.`)}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>☀️ Sunlight Needs</Text>
              <Text style={styles.detailSectionText}>
                {cleanText(`Prefers: ${sqliteDetail ? JSON.parse(sqliteDetail.sunlight).join(', ') : 'Bright indirect light'}. Keep away from dark, windowless corners or intense direct sun which burns leaves.`)}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🌵 Drought Tolerance</Text>
              <Text style={styles.detailSectionText}>
                {cleanText(`Drought Resistant: ${sqliteDetail?.drought_tolerant === 1 ? 'Yes' : 'No'}. ${sqliteDetail?.drought_tolerant === 1 ? 'This plant can survive periods of drought and is very forgiving.' : 'This plant requires consistent moisture to thrive.'}`)}
              </Text>
            </View>
          </View>
        )}

        {/* Tab Content (Health active) */}
        {activeTab === 'Health' && (
          <View style={styles.overviewContainer}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🛡️ Maintenance & Care Level</Text>
              <Text style={styles.detailSectionText}>
                {cleanText(`Difficulty Rating: ${sqliteDetail?.care_level || 'Easy'}. Suitable for plant parents of all experience levels.`)}
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🚫 Toxicity Status</Text>
              <View style={styles.toxicityRow}>
                <Text style={styles.toxicityLabel}>Toxic to Humans:</Text>
                <Text style={[styles.toxicityValue, sqliteDetail?.poisonous_to_humans === 1 ? styles.toxicAlert : styles.nonToxic]}>
                  {sqliteDetail?.poisonous_to_humans === 1 ? 'Yes, Toxic' : 'No, Safe'}
                </Text>
              </View>
              <View style={[styles.toxicityRow, { marginTop: 8 }]}>
                <Text style={styles.toxicityLabel}>Toxic to Pets:</Text>
                <Text style={[styles.toxicityValue, sqliteDetail?.poisonous_to_pets === 1 ? styles.toxicAlert : styles.nonToxic]}>
                  {sqliteDetail?.poisonous_to_pets === 1 ? 'Yes, Toxic' : 'No, Safe'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab Content (About active) */}
        {activeTab === 'About' && (
          <View style={styles.overviewContainer}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🧬 Taxonomy & Origin</Text>
              <View style={styles.taxonomyTable}>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Common Name</Text>
                  <Text style={styles.taxonomyValueText}>{sqliteDetail?.common_name || commonName}</Text>
                </View>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Scientific Name</Text>
                  <Text style={[styles.taxonomyValueText, { fontStyle: 'italic' }]}>{sqliteDetail?.scientific_name || scientificName}</Text>
                </View>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Family</Text>
                  <Text style={styles.taxonomyValueText}>{sqliteDetail?.family || 'Plantaceae'}</Text>
                </View>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Genus</Text>
                  <Text style={styles.taxonomyValueText}>{sqliteDetail?.genus || 'Genus'}</Text>
                </View>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Cycle</Text>
                  <Text style={styles.taxonomyValueText}>{sqliteDetail?.cycle || 'Perennial'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🍎 Usage Properties</Text>
              <View style={styles.taxonomyTable}>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Medicinal Value</Text>
                  <Text style={styles.taxonomyValueText}>{sqliteDetail?.medicinal === 1 ? 'Yes, therapeutic properties' : 'None reported'}</Text>
                </View>
                <View style={styles.taxonomyRow}>
                  <Text style={styles.taxonomyLabel}>Edible Value</Text>
                  <Text style={styles.taxonomyValueText}>{sqliteDetail?.edible === 1 ? 'Yes, edible parts' : 'Non-edible'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Tab Content (Similar active) */}
        {activeTab === 'Similar' && (
          <View style={styles.overviewContainer}>
            <Text style={styles.detailSectionTitle}>🌿 Related Varieties</Text>
            <Text style={styles.detailSectionText}>
              {cleanText(`Explore species within the family ${sqliteDetail?.family || 'Plantaceae'} to discover similar plants that thrive under similar climate and lighting conditions!`)}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Action Footer */}
      <View style={styles.footerContainer}>
        {/* Heart / Save Button */}
        <TouchableOpacity 
          style={[styles.saveBtn, isSaved ? styles.saveBtnActive : styles.saveBtnInactive]} 
          activeOpacity={0.85}
          onPress={handleSaveToggle}
        >
          <Text style={{ fontSize: 18, color: isSaved ? '#FFFFFF' : '#1C3A27', marginRight: 6 }}>
            {isSaved ? '♥' : '♡'}
          </Text>
          <Text style={[styles.saveBtnText, isSaved ? styles.saveBtnTextActive : styles.saveBtnTextInactive]}>
            {isSaved ? "Saved" : "Save"}
          </Text>
        </TouchableOpacity>

        {/* Set Reminder Button */}
        <TouchableOpacity 
          style={styles.reminderBtn} 
          activeOpacity={0.85}
          onPress={() => router.push({
            pathname: '/care-reminder',
            params: { plantName: commonName }
          })}
        >
          <Text style={{ fontSize: 16, marginRight: 6 }}>📅</Text>
          <Text style={styles.reminderBtnText}>Reminder</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5EF',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
    paddingBottom: 120, // space for footer
  },
  heroSection: {
    width: '100%',
    height: 250,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: {
    width: '80%',
    height: '90%',
  },
  matchBadge: {
    position: 'absolute',
    top: 16,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4EA',
    borderWidth: 1,
    borderColor: '#7DA676',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4E8C44',
    marginLeft: 4,
  },
  slideIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  slideText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  identityContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5EF',
  },
  plantName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C3A27',
  },
  botanicalName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#718E7B',
    marginTop: 2,
  },
  commonNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  commonNameText: {
    fontSize: 12,
    color: '#8CA696',
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F8F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C3A27',
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5EF',
  },
  tabsScrollContent: {
    paddingHorizontal: 24,
    height: 48,
    alignItems: 'center',
  },
  tabItem: {
    marginRight: 28,
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8CA696',
  },
  tabTextActive: {
    color: '#4E8C44',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4E8C44',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  overviewContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  descRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  descLeft: {
    flex: 1.2,
  },
  descText: {
    fontSize: 13,
    color: '#718E7B',
    lineHeight: 18,
    fontWeight: '500',
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7DA676',
  },
  descRight: {
    flex: 0.8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F5EF',
  },
  specItem: {
    alignItems: 'flex-start',
  },
  specLabel: {
    fontSize: 10,
    color: '#8CA696',
    fontWeight: '600',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C3A27',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C3A27',
  },
  calendarLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calendarLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7DA676',
  },
  careGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  careCard: {
    width: 140,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    marginRight: 12,
  },
  waterCard: {
    backgroundColor: '#EEF6FC',
    borderColor: '#DFEEF9',
  },
  lightCard: {
    backgroundColor: '#FFF8EB',
    borderColor: '#FFEED1',
  },
  tempCard: {
    backgroundColor: '#FFF2F2',
    borderColor: '#FFE0E0',
  },
  humidityCard: {
    backgroundColor: '#EEF9F6',
    borderColor: '#DFFAF3',
  },
  careIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  waterIconBg: {
    backgroundColor: '#FFFFFF',
  },
  lightIconBg: {
    backgroundColor: '#FFFFFF',
  },
  tempIconBg: {
    backgroundColor: '#FFFFFF',
  },
  humidityIconBg: {
    backgroundColor: '#FFFFFF',
  },
  careCardTitle: {
    fontSize: 10,
    color: '#8CA696',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  careCardDesc: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C3A27',
    marginTop: 2,
  },
  careCardDetails: {
    fontSize: 10,
    color: '#718E7B',
    marginTop: 6,
    lineHeight: 13,
    fontWeight: '500',
  },
  plantTipBanner: {
    flexDirection: 'row',
    backgroundColor: '#F3FBF5',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2F2E7',
    marginBottom: 24,
  },
  tipIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  tipTextCol: {
    flex: 1,
  },
  tipBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C3A27',
  },
  tipBannerDesc: {
    fontSize: 11,
    color: '#2E4C38',
    lineHeight: 16,
    marginTop: 4,
    fontWeight: '500',
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
  },
  petCardToxic: {
    backgroundColor: '#FFF2F2',
    borderColor: '#FFE0E0',
  },
  petCardSafe: {
    backgroundColor: '#F3FBF5',
    borderColor: '#E0F5E6',
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  petWarningIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  petTextCol: {
    flex: 1,
  },
  petTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  petTitleToxic: {
    color: '#C84C4C',
  },
  petTitleSafe: {
    color: '#4E8C44',
  },
  petDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
    fontWeight: '500',
  },
  petDescToxic: {
    color: '#A03C3C',
  },
  petDescSafe: {
    color: '#5A7F66',
  },
  petGraphicContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  learnMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  learnMoreBtnToxic: {
    borderColor: '#FFE0E0',
  },
  learnMoreBtnSafe: {
    borderColor: '#E0F5E6',
  },
  learnMoreText: {
    fontSize: 9,
    fontWeight: '700',
    marginRight: 2,
  },
  learnMoreTextToxic: {
    color: '#C84C4C',
  },
  learnMoreTextSafe: {
    color: '#4E8C44',
  },
  specIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  careScrollContent: {
    paddingRight: 24,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F5EF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 8,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#4E8C44',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  saveBtnInactive: {
    backgroundColor: '#F1F7F2',
    borderWidth: 1.5,
    borderColor: '#A3C69D',
  },
  saveBtnActive: {
    backgroundColor: '#4E8C44',
    borderWidth: 1.5,
    borderColor: '#4E8C44',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtnTextInactive: {
    color: '#1C3A27',
  },
  saveBtnTextActive: {
    color: '#FFFFFF',
  },
  reminderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E8C44',
    borderWidth: 1.5,
    borderColor: '#4E8C44',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#4E8C44',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  reminderBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  askAiBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#7DA676',
    borderRadius: 14,
    paddingVertical: 12,
  },
  askAiBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4E8C44',
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#1C3A27',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1C3A27',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 9999,
  },
  toastIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#FFFFFF',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBF2EA',
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C3A27',
    marginBottom: 8,
  },
  detailSectionText: {
    fontSize: 12,
    color: '#718E7B',
    lineHeight: 18,
    fontWeight: '500',
  },
  toxicityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toxicityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#718E7B',
  },
  toxicityValue: {
    fontSize: 12,
    fontWeight: '800',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toxicAlert: {
    backgroundColor: '#FFF0F0',
    color: '#C84C4C',
  },
  nonToxic: {
    backgroundColor: '#EBF4EA',
    color: '#4E8C44',
  },
  taxonomyTable: {
    marginTop: 4,
  },
  taxonomyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5EF',
  },
  taxonomyLabel: {
    fontSize: 12,
    color: '#8CA696',
    fontWeight: '600',
  },
  taxonomyValueText: {
    fontSize: 12,
    color: '#1C3A27',
    fontWeight: '700',
  },
});
