import { FlashList } from '@shopify/flash-list';
import type { UseQueryResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthedImage } from '@/shared/components/AuthedImage';
import { EmptyState } from '@/shared/components/EmptyState';
import type { AdminPendingContribution } from '@/shared/generated/model/adminPendingContribution';
import type { AdminQueueItem } from '@/shared/generated/model/adminQueueItem';
import { formatRelativeKo } from '@/shared/lib/format';

import { useAdminPendingContributions } from '../hooks/useAdminPendingContributions';
import { useAdminQueue } from '../hooks/useAdminQueue';
import { ADMIN_ROUTES } from '../routes';
import { ADMIN_LOADING_TITLE } from './strings';

const QUEUE_TITLE = '관리자 대기 큐';
const REPORTS_TAB = '신고';
const CONTRIBUTIONS_TAB = '대기 머신';
const EMPTY_REPORTS_TITLE = '처리 대기 신고 없음';
const EMPTY_REPORTS_DESCRIPTION = '모든 신고가 처리되었어요';
const EMPTY_CONTRIBUTIONS_TITLE = '대기 중인 머신 기여 없음';
const EMPTY_CONTRIBUTIONS_DESCRIPTION = '아직 검토할 사용자 머신 기여가 없어요';
const ERROR_REPORTS_TITLE = '신고 큐를 불러오지 못했어요';
const ERROR_CONTRIBUTIONS_TITLE = '대기 머신을 불러오지 못했어요';

const THUMB_SIZE = 56;

type Tab = 'reports' | 'contributions';

function keyByTarget(item: AdminQueueItem) {
  return `${item.type}:${item.targetId}`;
}

function keyByContribution(item: AdminPendingContribution) {
  return item.gymMachineId;
}

function navigateToItem(item: AdminQueueItem) {
  if (item.type === 'photo') {
    router.push(ADMIN_ROUTES.photo(item.targetId));
    return;
  }
  router.push(ADMIN_ROUTES.gymMachine(item.targetId));
}

function navigateToContribution(item: AdminPendingContribution) {
  router.push(ADMIN_ROUTES.contribution(item.gymMachineId));
}

export function AdminQueueScreen() {
  const reports = useAdminQueue();
  const contributions = useAdminPendingContributions();
  const reportCount = reports.data?.length ?? 0;
  const contributionCount = contributions.data?.length ?? 0;
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <Header />
      <TabBar
        tab={tab}
        onChange={setTab}
        reportCount={reportCount}
        contributionCount={contributionCount}
      />
      {tab === 'reports' ? (
        <ReportsTab query={reports} />
      ) : (
        <ContributionsTab query={contributions} />
      )}
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View className="border-b border-border-base px-4 py-3">
      <Text className="text-lg font-semibold text-text-primary">{QUEUE_TITLE}</Text>
    </View>
  );
}

interface TabBarProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
  reportCount: number;
  contributionCount: number;
}

function TabBar({ tab, onChange, reportCount, contributionCount }: TabBarProps) {
  return (
    <View className="flex-row gap-2 border-b border-border-base px-4 py-2">
      <TabButton
        label={`${REPORTS_TAB} (${reportCount.toString()})`}
        active={tab === 'reports'}
        onPress={() => {
          onChange('reports');
        }}
        testID="admin-queue-tab-reports"
      />
      <TabButton
        label={`${CONTRIBUTIONS_TAB} (${contributionCount.toString()})`}
        active={tab === 'contributions'}
        onPress={() => {
          onChange('contributions');
        }}
        testID="admin-queue-tab-contributions"
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      testID={testID}
      className={`flex-1 rounded-md px-3 py-2 ${active ? 'bg-accent-50' : 'bg-bg-base'}`}
    >
      <Text
        className={`text-center text-sm ${active ? 'font-semibold text-accent' : 'text-text-secondary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface ReportsTabProps {
  query: UseQueryResult<AdminQueueItem[]>;
}

function ReportsTab({ query }: ReportsTabProps) {
  if (query.isError) {
    return <EmptyState icon="error-outline" title={ERROR_REPORTS_TITLE} />;
  }
  if (query.isLoading || query.data === undefined) {
    return <EmptyState icon="hourglass-empty" title={ADMIN_LOADING_TITLE} />;
  }
  return (
    <FlashList
      data={query.data}
      keyExtractor={keyByTarget}
      ItemSeparatorComponent={QueueSeparator}
      ListEmptyComponent={
        <EmptyState
          icon="inbox"
          title={EMPTY_REPORTS_TITLE}
          description={EMPTY_REPORTS_DESCRIPTION}
        />
      }
      renderItem={renderQueueRow}
    />
  );
}

interface ContributionsTabProps {
  query: UseQueryResult<AdminPendingContribution[]>;
}

function ContributionsTab({ query }: ContributionsTabProps) {
  if (query.isError) {
    return <EmptyState icon="error-outline" title={ERROR_CONTRIBUTIONS_TITLE} />;
  }
  if (query.isLoading || query.data === undefined) {
    return <EmptyState icon="hourglass-empty" title={ADMIN_LOADING_TITLE} />;
  }
  return (
    <FlashList
      data={query.data}
      keyExtractor={keyByContribution}
      ItemSeparatorComponent={QueueSeparator}
      ListEmptyComponent={
        <EmptyState
          icon="inbox"
          title={EMPTY_CONTRIBUTIONS_TITLE}
          description={EMPTY_CONTRIBUTIONS_DESCRIPTION}
        />
      }
      renderItem={renderContributionRow}
    />
  );
}

function QueueSeparator() {
  return <View className="h-px bg-border-subtle" />;
}

/**
 * Square thumbnail used by both queue tabs. Renders the photo when present
 * and a "머신" placeholder otherwise. Extracted from QueueRow / ContributionRow
 * so both rows share one source for the `THUMB_SIZE` + corner-radius pair.
 */
function RowThumb({ contentPath }: { contentPath: string | undefined }) {
  if (contentPath !== undefined) {
    return (
      <AuthedImage
        contentPath={contentPath}
        style={{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 }}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View
      style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
      className="items-center justify-center rounded-lg bg-bg-muted"
    >
      <Text className="text-xs text-text-secondary">머신</Text>
    </View>
  );
}

function renderQueueRow({ item }: { item: AdminQueueItem }) {
  return <QueueRow item={item} />;
}

function QueueRow({ item }: { item: AdminQueueItem }) {
  const contentPath = item.type === 'photo' ? item.contentPath : undefined;
  return (
    <Pressable
      testID={`admin-queue-row-${item.type}-${item.targetId}`}
      onPress={() => {
        navigateToItem(item);
      }}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-bg-elevated"
    >
      <RowThumb contentPath={contentPath} />
      <View className="flex-1">
        <Text className="text-base font-medium text-text-primary" numberOfLines={1}>
          {item.label} · 신고 {item.pendingReportCount}건
        </Text>
        <Text className="text-sm text-text-secondary">
          {item.topReason} · {formatRelativeKo(item.oldestReportAt)}
        </Text>
      </View>
      <Text className="text-text-secondary">›</Text>
    </Pressable>
  );
}

function renderContributionRow({ item }: { item: AdminPendingContribution }) {
  return <ContributionRow item={item} />;
}

function ContributionRow({ item }: { item: AdminPendingContribution }) {
  return (
    <Pressable
      testID={`admin-contribution-row-${item.gymMachineId}`}
      onPress={() => {
        navigateToContribution(item);
      }}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-bg-elevated"
    >
      <RowThumb contentPath={item.contentPath} />
      <View className="flex-1">
        <Text className="text-base font-medium text-text-primary" numberOfLines={1}>
          {item.freeFormName}
        </Text>
        <Text className="text-sm text-text-secondary" numberOfLines={1}>
          {item.gymName} · {formatRelativeKo(item.createdAt)}
        </Text>
      </View>
      <Text className="text-text-secondary">›</Text>
    </Pressable>
  );
}
