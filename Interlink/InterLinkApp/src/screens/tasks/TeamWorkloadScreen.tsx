import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Users,
  Search,
  X,
  AlertCircle,
  Briefcase,
  CheckCircle2,
} from 'lucide-react-native';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { fetchTaskDashboard, TeamWorkloadMember, TaskDashboardData } from '../../api/taskApi';

export const TeamWorkloadScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [dashboardData, setDashboardData] = useState<TaskDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('TasksScreen');
    }
  }, [navigation]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchTaskDashboard();
      if (res.success && res.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Error fetching workload data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const workload = useMemo(
    () => dashboardData?.workload || [],
    [dashboardData?.workload]
  );

  const filteredWorkload = useMemo(() => {
    if (!search.trim()) return workload;
    const q = search.toLowerCase().trim();
    return workload.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q))
    );
  }, [workload, search]);

  const totalMembers = workload.length;
  const overloadedCount = workload.filter(
    (m) => parseFloat(String(m.total_estimated_hours || 0)) > 40
  ).length;
  const balancedCount = workload.filter((m) => {
    const est = parseFloat(String(m.total_estimated_hours || 0));
    return est >= 10 && est <= 40;
  }).length;

  return (
    <ScreenWrapper
      dark={false}
      edges={['right', 'bottom', 'left']}
      statusBarStyle="light-content"
    >
      <AppHeader
        title="Team Workload & Capacity"
        showBack={true}
        onBackPress={handleBack}
        backgroundColor={theme.colors.primary}
        curveRadius={65}
      />

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#17365D']}
            tintColor="#17365D"
          />
        }
      >
        {/* Summary Metric Pills */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, styles.summaryPillPurple]}>
            <Users size={14} color="#7C3AED" />
            <Text style={styles.summaryPillPurpleText}>
              {totalMembers} Members
            </Text>
          </View>
          <View style={[styles.summaryPill, styles.summaryPillGreen]}>
            <CheckCircle2 size={14} color="#15803D" />
            <Text style={styles.summaryPillGreenText}>
              {balancedCount} Balanced
            </Text>
          </View>
          <View style={[styles.summaryPill, styles.summaryPillRed]}>
            <AlertCircle size={14} color="#DC2626" />
            <Text style={styles.summaryPillRedText}>
              {overloadedCount} Overloaded
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search member by name or email..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Workload Members List */}
        {loading && workload.length === 0 ? (
          <View style={styles.sectionCenterLoading}>
            <ActivityIndicator size="large" color="#17365D" />
            <Text style={styles.sectionLoadingText}>Loading team workload...</Text>
          </View>
        ) : filteredWorkload.length === 0 ? (
          <View style={styles.emptyCard}>
            <Briefcase size={28} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No team members found</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? 'Try adjusting your search criteria.'
                : 'No workload data currently available.'}
            </Text>
          </View>
        ) : (
          <View style={styles.workloadListContainer}>
            {filteredWorkload.map((member: TeamWorkloadMember) => {
              const est = parseFloat(String(member.total_estimated_hours)) || 0;
              const logged = parseFloat(String(member.total_logged_hours)) || 0;

              let loadBadgeStyle = styles.badgeGreen;
              let loadBadgeTextStyle = styles.badgeGreenText;
              let loadLabel = 'Balanced';
              let barColor = '#10B981';

              if (est > 40) {
                loadBadgeStyle = styles.badgeRed;
                loadBadgeTextStyle = styles.badgeRedText;
                loadLabel = 'Overloaded (>40h)';
                barColor = '#EF4444';
              } else if (est < 10) {
                loadBadgeStyle = styles.badgeSlate;
                loadBadgeTextStyle = styles.badgeSlateText;
                loadLabel = 'Light (<10h)';
                barColor = '#94A3B8';
              }

              const capacityPct = Math.min(Math.round((est / 40) * 100), 150);

              return (
                <View key={member.user_id} style={styles.workloadCard}>
                  {/* Top: Avatar, Name, Email & Capacity Badge */}
                  <View style={styles.userRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {(member.name || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{member.name}</Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {member.email}
                      </Text>
                    </View>
                    <View style={[styles.microBadge, loadBadgeStyle]}>
                      <Text style={[styles.microBadgeText, loadBadgeTextStyle]}>
                        {loadLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Capacity Bar relative to 40h workweek */}
                  <View style={styles.capacityBarRow}>
                    <View style={styles.capacityLabelRow}>
                      <Text style={styles.capacityLabel}>
                        Capacity Allocation ({est}h / 40h standard)
                      </Text>
                      <Text style={styles.capacityPct}>{capacityPct}%</Text>
                    </View>
                    <View style={styles.capacityTrack}>
                      <View
                        style={[
                          styles.capacityFill,
                          {
                            width: `${Math.min(capacityPct, 100)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* 3 Metric Tiles */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricNumber}>
                        {member.active_tasks}
                      </Text>
                      <Text style={styles.metricLabel}>Active Tasks</Text>
                    </View>

                    <View style={styles.metricBox}>
                      <Text style={styles.metricNumber}>{est.toFixed(1)}h</Text>
                      <Text style={styles.metricLabel}>Estimated Load</Text>
                    </View>

                    <View style={styles.metricBox}>
                      <Text style={[styles.metricNumber, styles.textGreen]}>
                        {logged.toFixed(1)}h
                      </Text>
                      <Text style={styles.metricLabel}>Actual Logged</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenScroll: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  screenScrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryPillPurple: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  summaryPillPurpleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  summaryPillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  summaryPillGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  summaryPillRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  summaryPillRedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  sectionCenterLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  sectionLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  workloadListContainer: {
    gap: 10,
  },
  workloadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#17365D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  microBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  badgeGreenText: {
    color: '#15803D',
  },
  badgeRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeRedText: {
    color: '#DC2626',
  },
  badgeSlate: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  badgeSlateText: {
    color: '#64748B',
  },
  microBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  capacityBarRow: {
    gap: 4,
  },
  capacityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  capacityPct: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17365D',
  },
  capacityTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  textGreen: {
    color: '#10B981',
  },
});
