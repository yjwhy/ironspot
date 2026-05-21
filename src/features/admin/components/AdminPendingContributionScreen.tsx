import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import type { PromoteContributionRequest } from '@/shared/generated/model/promoteContributionRequest';
import { formatRelativeKo } from '@/shared/lib/format';
import { templateDisplayName } from '@/shared/lib/template-display-name';

import { useAdminPendingContributions } from '../hooks/useAdminPendingContributions';
import { usePromoteContribution } from '../hooks/usePromoteContribution';
import { useRejectContribution } from '../hooks/useRejectContribution';

const HEADER_TITLE = '대기 머신 검토';
const LOADING_TITLE = '불러오는 중…';
const NOT_FOUND_TITLE = '대기 중인 기여가 아니에요';
const PHOTO_HEIGHT = 200;
const REJECT_CONFIRM_TITLE = '이 기여를 반려할까요?';
const REJECT_CONFIRM_BODY =
  '반려하면 사용자가 등록한 머신은 노출되지 않아요. 사진은 감사 기록을 위해 남아요.';

type PromoteMode = 'existing' | 'newTemplate' | 'newBrandAndTemplate';
type LoadingType = 'pin' | 'plate';

interface AdminPendingContributionScreenProps {
  gymMachineId: string;
}

export function AdminPendingContributionScreen({
  gymMachineId,
}: AdminPendingContributionScreenProps) {
  const list = useAdminPendingContributions();
  const contribution = list.data?.find((row) => row.gymMachineId === gymMachineId);

  if (list.isError) {
    return (
      <ScreenShell>
        <EmptyState icon="error-outline" title="대기 머신을 불러오지 못했어요" />
      </ScreenShell>
    );
  }
  if (list.isLoading || list.data === undefined) {
    return (
      <ScreenShell>
        <EmptyState icon="hourglass-empty" title={LOADING_TITLE} />
      </ScreenShell>
    );
  }
  if (contribution === undefined) {
    return (
      <ScreenShell>
        <EmptyState icon="inbox" title={NOT_FOUND_TITLE} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Section title="헬스장">
          <Text className="text-base text-text-primary">{contribution.gymName}</Text>
        </Section>
        <Section title="사용자가 입력한 머신명">
          <Text className="text-xl font-semibold text-text-primary">
            {contribution.freeFormName}
          </Text>
          <Text className="text-xs text-text-secondary">
            제출 {formatRelativeKo(contribution.createdAt)}
          </Text>
        </Section>
        {contribution.photoUrl !== undefined && (
          <Section title="첨부 사진">
            <Image
              source={{ uri: contribution.photoUrl }}
              style={{ width: '100%', height: PHOTO_HEIGHT, borderRadius: 12 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Section>
        )}
        <PromoteSection gymMachineId={gymMachineId} />
        <RejectSection gymMachineId={gymMachineId} />
      </ScrollView>
    </ScreenShell>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-row items-center justify-between border-b border-border-base px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() => {
            router.back();
          }}
        >
          <Text className="text-text-secondary">‹ 뒤로</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary">{HEADER_TITLE}</Text>
        <View style={{ width: 40 }} />
      </View>
      {children}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="rounded-xl bg-bg-elevated p-4">
      <Text className="mb-2 text-xs font-semibold uppercase text-text-secondary">{title}</Text>
      {children}
    </View>
  );
}

function PromoteSection({ gymMachineId }: { gymMachineId: string }) {
  const [mode, setMode] = useState<PromoteMode>('existing');
  const promote = usePromoteContribution(gymMachineId, {
    onSuccess: () => {
      router.back();
    },
  });

  return (
    <Section title="승격">
      <ModeTabs mode={mode} onChange={setMode} />
      <View className="mt-3">
        {mode === 'existing' && (
          <ExistingTemplateForm onSubmit={promote.handlePromote} isPending={promote.isPending} />
        )}
        {mode === 'newTemplate' && (
          <NewTemplateForm onSubmit={promote.handlePromote} isPending={promote.isPending} />
        )}
        {mode === 'newBrandAndTemplate' && (
          <NewBrandAndTemplateForm onSubmit={promote.handlePromote} isPending={promote.isPending} />
        )}
      </View>
    </Section>
  );
}

function ModeTabs({ mode, onChange }: { mode: PromoteMode; onChange: (m: PromoteMode) => void }) {
  return (
    <View className="flex-row gap-2">
      <ModeTab label="기존 매핑" value="existing" current={mode} onPress={onChange} />
      <ModeTab label="새 템플릿" value="newTemplate" current={mode} onPress={onChange} />
      <ModeTab label="새 브랜드" value="newBrandAndTemplate" current={mode} onPress={onChange} />
    </View>
  );
}

function ModeTab({
  label,
  value,
  current,
  onPress,
}: {
  label: string;
  value: PromoteMode;
  current: PromoteMode;
  onPress: (m: PromoteMode) => void;
}) {
  const active = value === current;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        onPress(value);
      }}
      className={`flex-1 rounded-md border px-3 py-2 ${
        active ? 'border-accent bg-accent-50' : 'border-border-base bg-bg-base'
      }`}
    >
      <Text
        className={`text-center text-sm ${active ? 'font-semibold text-accent' : 'text-text-primary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FormProps {
  onSubmit: (data: PromoteContributionRequest) => void;
  isPending: boolean;
}

function ExistingTemplateForm({ onSubmit, isPending }: FormProps) {
  const templates = useMachineTemplates();
  const data = templates.data ?? [];

  if (data.length === 0) {
    return <Text className="text-sm text-text-secondary">사용 가능한 템플릿이 없어요</Text>;
  }

  return (
    <ScrollView style={{ maxHeight: 280 }}>
      {data.map((template) => (
        <Pressable
          key={template.id}
          accessibilityRole="button"
          accessibilityLabel={`${template.brandName} ${templateDisplayName(template)} 매핑`}
          disabled={isPending}
          onPress={() => {
            onSubmit({ kind: 'existingTemplate', templateId: template.id });
          }}
          className="border-b border-border-subtle px-2 py-3 active:bg-bg-elevated"
        >
          <Text className="text-sm text-text-primary">
            {template.brandName} {templateDisplayName(template)} ·{' '}
            {template.loadingType === 'pin' ? '핀' : '플레이트'}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function NewTemplateForm({ onSubmit, isPending }: FormProps) {
  const brands = useBrands();
  const categories = useCategories();
  const [brandId, setBrandId] = useState<string>('');
  const [nameEn, setNameEn] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [loadingType, setLoadingType] = useState<LoadingType>('pin');
  const [categoryId, setCategoryId] = useState<string>('');

  const canSubmit = brandId !== '' && nameEn.trim() !== '' && nameKo.trim() !== '';

  function submit() {
    onSubmit({
      kind: 'newTemplate',
      brandId,
      nameEn: nameEn.trim(),
      nameKo: nameKo.trim(),
      loadingType,
      ...(categoryId !== '' ? { categoryId } : {}),
    });
  }

  return (
    <View className="gap-3">
      <FieldLabel label="브랜드" />
      <PickerRow items={brands.data ?? []} value={brandId} onChange={setBrandId} />
      <FieldLabel label="영문 이름" />
      <Input value={nameEn} onChangeText={setNameEn} placeholder="Lat Pulldown" />
      <FieldLabel label="한국어 이름" />
      <Input value={nameKo} onChangeText={setNameKo} placeholder="랫 풀다운" />
      <FieldLabel label="로딩 방식" />
      <LoadingTypeToggle value={loadingType} onChange={setLoadingType} />
      <FieldLabel label="운동 부위 (선택)" />
      <PickerRow
        items={categories.data ?? []}
        value={categoryId}
        onChange={setCategoryId}
        allowEmpty
      />
      <Button label="승격" disabled={!canSubmit || isPending} onPress={submit} />
    </View>
  );
}

function NewBrandAndTemplateForm({ onSubmit, isPending }: FormProps) {
  const categories = useCategories();
  const [brandName, setBrandName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [loadingType, setLoadingType] = useState<LoadingType>('pin');
  const [categoryId, setCategoryId] = useState<string>('');

  const canSubmit = brandName.trim() !== '' && nameEn.trim() !== '' && nameKo.trim() !== '';

  function submit() {
    onSubmit({
      kind: 'newBrandAndTemplate',
      newBrandName: brandName.trim(),
      nameEn: nameEn.trim(),
      nameKo: nameKo.trim(),
      loadingType,
      ...(categoryId !== '' ? { categoryId } : {}),
    });
  }

  return (
    <View className="gap-3">
      <FieldLabel label="브랜드 이름" />
      <Input value={brandName} onChangeText={setBrandName} placeholder="새 브랜드명" />
      <FieldLabel label="영문 이름" />
      <Input value={nameEn} onChangeText={setNameEn} placeholder="Lat Pulldown" />
      <FieldLabel label="한국어 이름" />
      <Input value={nameKo} onChangeText={setNameKo} placeholder="랫 풀다운" />
      <FieldLabel label="로딩 방식" />
      <LoadingTypeToggle value={loadingType} onChange={setLoadingType} />
      <FieldLabel label="운동 부위 (선택)" />
      <PickerRow
        items={categories.data ?? []}
        value={categoryId}
        onChange={setCategoryId}
        allowEmpty
      />
      <Button label="승격" disabled={!canSubmit || isPending} onPress={submit} />
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text className="text-xs font-semibold text-text-secondary">{label}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      className="rounded-md border border-border-base bg-bg-base px-3 py-2 text-text-primary"
      placeholderTextColor="#9ca3af"
    />
  );
}

interface PickerItem {
  id: string;
  name: string;
}

function PickerRow({
  items,
  value,
  onChange,
  allowEmpty,
}: {
  items: PickerItem[];
  value: string;
  onChange: (id: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {allowEmpty === true && (
        <PickerChip
          label="없음"
          active={value === ''}
          onPress={() => {
            onChange('');
          }}
        />
      )}
      {items.map((item) => (
        <PickerChip
          key={item.id}
          label={item.name}
          active={value === item.id}
          onPress={() => {
            onChange(item.id);
          }}
        />
      ))}
    </ScrollView>
  );
}

function PickerChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`rounded-full border px-3 py-1 ${
        active ? 'border-accent bg-accent-50' : 'border-border-base bg-bg-base'
      }`}
    >
      <Text className={`text-xs ${active ? 'font-semibold text-accent' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function LoadingTypeToggle({
  value,
  onChange,
}: {
  value: LoadingType;
  onChange: (v: LoadingType) => void;
}) {
  return (
    <View className="flex-row gap-2">
      <PickerChip
        label="핀"
        active={value === 'pin'}
        onPress={() => {
          onChange('pin');
        }}
      />
      <PickerChip
        label="플레이트"
        active={value === 'plate'}
        onPress={() => {
          onChange('plate');
        }}
      />
    </View>
  );
}

function RejectSection({ gymMachineId }: { gymMachineId: string }) {
  const reject = useRejectContribution(gymMachineId, {
    onSuccess: () => {
      router.back();
    },
  });

  function confirmReject() {
    Alert.alert(REJECT_CONFIRM_TITLE, REJECT_CONFIRM_BODY, [
      { text: '취소', style: 'cancel' },
      {
        text: '반려',
        style: 'destructive',
        onPress: () => {
          reject.handleReject();
        },
      },
    ]);
  }

  return (
    <View className="px-4 pb-8 pt-2">
      <Button
        label="반려"
        variant="secondary"
        disabled={reject.isPending}
        onPress={confirmReject}
      />
    </View>
  );
}
