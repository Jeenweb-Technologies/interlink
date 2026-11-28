import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  CheckSquare,
  Clock,
  Calendar,
  FolderKanban,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  BellRing,
  CheckCircle2,
} from 'lucide-react-native';
import { AuthStackParamList } from '../../navigation/types';
import { InterlinkLogo } from '../../components/common/InterlinkLogo';
import { theme } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type LandingScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Landing'
>;

interface LandingScreenProps {
  navigation: LandingScreenNavigationProp;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goToSlide = (index: number) => {
    if (index >= 0 && index <= 2) {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
      });
      setCurrentIndex(index);
    }
  };

  const handleNext = () => {
    if (currentIndex < 2) {
      goToSlide(currentIndex + 1);
    } else {
      navigation.navigate('Login');
    }
  };

  const handleSkip = () => {
    navigation.navigate('Login');
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: any) => {
      if (
        viewableItems &&
        viewableItems.length > 0 &&
        typeof viewableItems[0].index === 'number'
      ) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const getItemLayout = (_: any, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  /**
   * Reusable Consistent Header for All 3 Screens with Back button on screens 2 & 3
   * Matching MyVms UI design reference
   */
  const renderHeader = (slideIndex = 0) => (
    <View style={[styles.slideTopHeader, { paddingTop: insets.top + 8 }]}>
      <View style={styles.brandRowSimple}>
       

        <View style={styles.brandLogoSquare}>
          <InterlinkLogo size="sm" showText={false} light />
        </View>
        <Text style={styles.brandTitleText}>INTERLINK</Text>
      </View>

      <TouchableOpacity
        onPress={handleSkip}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
      >
        <Text style={styles.headerSkipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Reusable Consistent Bottom Bar with 3 Clickable Dots & Action Arrow Button
   * Matching MyVms UI design reference
   */
  const renderBottomBar = (slideIndex: number, isLast = false) => (
    <View
      style={[
        styles.slideBottomBar,
        { paddingBottom: Math.max(insets.bottom, 22) },
      ]}
    >
      {/* 3 Clickable Pagination Dots to jump directly to any previous/next slide */}
      <View style={styles.paginationDotsWrap}>
        {[0, 1, 2].map((idx) => {
          const isActive = slideIndex === idx;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => goToSlide(idx)}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${idx + 1}`}
            >
              <View
                style={[
                  styles.dotPill,
                  isActive ? styles.dotPillActive : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Arrow Button (Next or Get Started) */}
      <TouchableOpacity
        style={styles.actionArrowBtn}
        onPress={handleNext}
        activeOpacity={0.85}
      >
        <Text style={styles.actionArrowBtnText}>
          {isLast ? 'Get Started' : 'Next'}
        </Text>
        <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );

  // -------------------------------------------------------------
  // SLIDE 1: "Unified Workspace & Modern Operations"
  // -------------------------------------------------------------
  const renderSlide1 = () => (
    <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
      {renderHeader(0)}

      <View style={styles.slide1Body}>
        {/* Title & Tagline */}
        <View style={styles.slide1HeadingWrap}>
          <Text style={styles.slide1Heading}>
            {'Unified Workspace &\nModern Operations'}
          </Text>
          <Text style={styles.slide1SubHeading}>
            Experience seamless workplace management with smart task tracking, automated timesheets, and real-time team collaboration.
          </Text>
        </View>

        {/* Hero Visual Card */}
        <View style={styles.heroVisualCard}>
          {/* Top Floating Badge */}
        

          {/* Metric 1: Active Projects */}
          <View style={styles.heroMetricRow}>
            <View
              style={[
                styles.heroMetricIconWrap,
                { backgroundColor: 'rgba(56, 189, 248, 0.16)' },
              ]}
            >
              <FolderKanban size={18} color="#38BDF8" strokeWidth={2.2} />
            </View>
            <View style={styles.heroMetricTexts}>
              <Text style={styles.heroMetricTitle}>Project Deliverables</Text>
              <Text style={styles.heroMetricSub}>12 Active · 4 Milestones This Week</Text>
            </View>
            <View style={styles.heroMetricBadge}>
              <Text style={styles.heroMetricBadgeText}>+18%</Text>
            </View>
          </View>

          {/* Metric 2: Today's Shift & Attendance */}
          <View style={styles.heroMetricRow}>
            <View
              style={[
                styles.heroMetricIconWrap,
                { backgroundColor: 'rgba(16, 185, 129, 0.16)' },
              ]}
            >
              <Clock size={18} color="#10B981" strokeWidth={2.2} />
            </View>
            <View style={styles.heroMetricTexts}>
              <Text style={styles.heroMetricTitle}>Live Attendance & Shifts</Text>
              <Text style={styles.heroMetricSub}>Checked In · 09:00 AM - 06:00 PM</Text>
            </View>
            <View
              style={[
                styles.heroMetricBadge,
                { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
              ]}
            >
              <Text style={[styles.heroMetricBadgeText, { color: '#10B981' }]}>
                ON DUTY
              </Text>
            </View>
          </View>

          {/* Metric 3: Team Collaboration Pulse */}
          <View style={styles.heroMetricRow}>
            <View
              style={[
                styles.heroMetricIconWrap,
                { backgroundColor: 'rgba(99, 102, 241, 0.16)' },
              ]}
            >
              <Users size={18} color="#818CF8" strokeWidth={2.2} />
            </View>
            <View style={styles.heroMetricTexts}>
              <Text style={styles.heroMetricTitle}>Team Workload Pulse</Text>
              <Text style={styles.heroMetricSub}>24 Active Members · 94% On-Track</Text>
            </View>
            <View
              style={[
                styles.heroMetricBadge,
                { backgroundColor: 'rgba(99, 102, 241, 0.2)' },
              ]}
            >
              <CheckCircle2 size={13} color="#818CF8" strokeWidth={2.4} />
            </View>
          </View>
        </View>
      </View>

      {renderBottomBar(0, false)}
    </View>
  );

  // -------------------------------------------------------------
  // SLIDE 2: Features List (One Card Per Line with Alternating Offset)
  // Matching MyVms Slide 2 Signature UI Design
  // -------------------------------------------------------------
  const renderSlide2 = () => {
    const featureChips = [
      {
        id: 'tasks',
        title: 'Tasks & Kanban Boards',
        icon: CheckSquare,
        bg: '#EFF6FF',
        border: '#BFDBFE',
        color: '#2563EB',
      },
      {
        id: 'timesheets',
        title: 'Timesheets & Shifts',
        icon: Clock,
        bg: '#FEF3C7',
        border: '#FDE68A',
        color: '#D97706',
      },
      {
        id: 'calendar',
        title: 'Calendar & Schedules',
        icon: Calendar,
        bg: '#ECFDF5',
        border: '#A7F3D0',
        color: '#059669',
      },
      {
        id: 'projects',
        title: 'Projects & Workflows',
        icon: FolderKanban,
        bg: '#EEF2FF',
        border: '#C7D2FE',
        color: '#4F46E5',
      },
      {
        id: 'chat',
        title: 'Team Chat & Discussions',
        icon: MessageSquare,
        bg: '#F5F3FF',
        border: '#DDD6FE',
        color: '#7C3AED',
      },
      {
        id: 'masters',
        title: 'Organization Masters',
        icon: Building2,
        bg: '#ECFEFF',
        border: '#A5F3FC',
        color: '#0891B2',
      },
    ];

    return (
      <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
        {renderHeader(1)}

        <View style={styles.slide2Body}>
          {/* Feature Cards: One Card Per Line, Alternating Offset */}
          <View style={styles.cardsOnePerLineList}>
            {featureChips.map((chip, index) => {
              const IconComp = chip.icon;
              const isOffset = index % 2 === 1;
              return (
                <View
                  key={chip.id}
                  style={[
                    styles.featureChipCardFull,
                    {
                      backgroundColor: chip.bg,
                      borderColor: chip.border,
                      marginLeft: isOffset ? 44 : 0,
                      marginRight: isOffset ? 0 : 44,
                    },
                  ]}
                >
                  <View style={styles.chipIconBubble}>
                    <IconComp size={19} color={chip.color} strokeWidth={2.4} />
                  </View>
                  <Text
                    style={[styles.chipCardTitleFull, { color: chip.color }]}
                    numberOfLines={1}
                  >
                    {chip.title}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Description & Heading */}
          <View style={styles.slide2TextContent}>
            <Text style={styles.slide2Heading}>
              A smarter way to coordinate your entire organization.
            </Text>
            <Text style={styles.slide2Description}>
              Consolidate attendance, project tracking, calendar scheduling, and team discussions into one intuitive enterprise mobile portal.
            </Text>
          </View>
        </View>

        {renderBottomBar(1, false)}
      </View>
    );
  };

  // -------------------------------------------------------------
  // SLIDE 3: Highlights & Capabilities (Matching MyVms Slide 3)
  // -------------------------------------------------------------
  const renderSlide3 = () => (
    <View style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
      {renderHeader(2)}

      <View style={styles.slide3Body}>
        {/* 3 Enterprise Highlight Cards */}
        <View style={styles.highlightsContainer}>
          {/* Highlight 1 */}
          <View style={styles.societyHighlightCard}>
            <View
              style={[
                styles.highlightIconSquare,
                { backgroundColor: '#EFF6FF' },
              ]}
            >
              <Building2 size={22} color="#2563EB" strokeWidth={2.2} />
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={styles.highlightCardTitle}>
                Multi-Company & Organization
              </Text>
              <Text style={styles.highlightCardSub}>
                Seamlessly switch workspaces, assign user roles, and manage permissions with full administrative oversight.
              </Text>
            </View>
          </View>

          {/* Highlight 2 */}
          <View style={styles.societyHighlightCard}>
            <View
              style={[
                styles.highlightIconSquare,
                { backgroundColor: '#ECFDF5' },
              ]}
            >
              <ShieldCheck size={22} color="#059669" strokeWidth={2.2} />
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={styles.highlightCardTitle}>
                Hardware-Locked Device Security
              </Text>
              <Text style={styles.highlightCardSub}>
                Unique device ID registration and biometric verification safeguarding company data.
              </Text>
            </View>
          </View>

          {/* Highlight 3 */}
          <View style={styles.societyHighlightCard}>
            <View
              style={[
                styles.highlightIconSquare,
                { backgroundColor: '#FEF3C7' },
              ]}
            >
              <BellRing size={22} color="#D97706" strokeWidth={2.2} />
            </View>
            <View style={styles.highlightTextCol}>
              <Text style={styles.highlightCardTitle}>
                Smart Alerts & Timely Approvals
              </Text>
              <Text style={styles.highlightCardSub}>
                Never miss a milestone with alerts for timesheet submissions, meetings, and task deadlines.
              </Text>
            </View>
          </View>
        </View>

        {/* Lower Heading & Subtitle */}
        <View style={styles.slide3TextContent}>
          <Text style={styles.slide3Heading}>
            Transform Your Business Operations.
          </Text>
          <Text style={styles.slide3Description}>
            Deploy high-performance workplace management with real-time visibility, automated workflows, and enterprise reliability.
          </Text>
        </View>
      </View>

      {renderBottomBar(2, true)}
    </View>
  );

  const slides = [
    { key: 'slide1', render: renderSlide1 },
    { key: 'slide2', render: renderSlide2 },
    { key: 'slide3', render: renderSlide3 },
  ];

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => item.render()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },

  // -------------------------------------------------------------
  // CONSISTENT TOP HEADER (IDENTICAL ON ALL 3 SCREENS)
  // -------------------------------------------------------------
  slideTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    minHeight: 48,
  },
  brandRowSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtnHeader: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  brandLogoSquare: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  brandTitleText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#17365D',
    letterSpacing: 1,
  },
  headerSkipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  // -------------------------------------------------------------
  // SLIDE 1 STYLES
  // -------------------------------------------------------------
  slide1Body: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
  },
  slide1HeadingWrap: {
    gap: 8,
    paddingTop: 8,
  },
  slide1Heading: {
    fontSize: 27,
    fontWeight: '900',
    color: '#17365D',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  slide1SubHeading: {
    fontSize: 13.5,
    color: '#5B6573',
    lineHeight: 20,
    fontWeight: '500',
  },
  heroVisualCard: {
    backgroundColor: '#17365D',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#0B1B36',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  heroFloatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 4,
  },
  heroFloatingBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  heroMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroMetricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetricTexts: {
    flex: 1,
  },
  heroMetricTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroMetricSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  heroMetricBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroMetricBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#38BDF8',
  },

  // -------------------------------------------------------------
  // SLIDE 2 STYLES (MATCHING MYVMS ALTERNATING OFFSET CARDS)
  // -------------------------------------------------------------
  slide2Body: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardsOnePerLineList: {
    gap: 10,
    width: '100%',
  },
  featureChipCardFull: {
    width: SCREEN_WIDTH - 48 - 44,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  chipIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  chipCardTitleFull: {
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1,
  },
  slide2TextContent: {
    gap: 6,
    paddingTop: 6,
  },
  slide2Heading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#17365D',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  slide2Description: {
    fontSize: 13,
    color: '#5B6573',
    lineHeight: 19,
    fontWeight: '500',
  },

  // -------------------------------------------------------------
  // SLIDE 3 STYLES
  // -------------------------------------------------------------
  slide3Body: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 10,
  },
  highlightsContainer: {
    gap: 12,
    paddingTop: 6,
  },
  societyHighlightCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 13,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  highlightIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextCol: {
    flex: 1,
  },
  highlightCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#17365D',
    marginBottom: 2,
  },
  highlightCardSub: {
    fontSize: 11.5,
    color: '#5B6573',
    lineHeight: 16,
    fontWeight: '500',
  },
  slide3TextContent: {
    gap: 6,
    paddingTop: 6,
  },
  slide3Heading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#17365D',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  slide3Description: {
    fontSize: 13,
    color: '#5B6573',
    lineHeight: 19,
    fontWeight: '500',
  },

  // -------------------------------------------------------------
  // CONSISTENT BOTTOM BAR & ACTION BUTTON (IDENTICAL ON ALL 3 SCREENS)
  // -------------------------------------------------------------
  slideBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    minHeight: 56,
  },
  paginationDotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotPill: {
    height: 8,
    borderRadius: 4,
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  dotPillActive: {
    width: 24,
    backgroundColor: '#17365D',
  },
  actionArrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#17365D',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#17365D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionArrowBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
