import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { getListMachinesQueryKey } from '@/shared/generated/machines/machines';
import { useCreate, useUpdate } from '@/shared/generated/owner/owner';
import { captureError } from '@/shared/lib/sentry';

interface OwnerMachineFormProps {
  gymId: string;
  initial?: { id: string; templateId: string; quantity: number };
  onDone: () => void;
}

const MIN_QUANTITY = 1;

export function OwnerMachineForm({ gymId, initial, onDone }: OwnerMachineFormProps) {
  const templatesQuery = useMachineTemplates();
  const [templateId, setTemplateId] = useState<string | null>(initial?.templateId ?? null);
  const [quantityText, setQuantityText] = useState(String(initial?.quantity ?? 1));
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const queryClient = useQueryClient();
  const isEdit = initial !== undefined;
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit() {
    const parsedQuantity = Number.parseInt(quantityText, 10);
    if (templateId === null) {
      burnt.toast({ title: '머신 종류를 선택해 주세요', preset: 'error' });
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < MIN_QUANTITY) {
      burnt.toast({ title: '수량은 1 이상이어야 해요', preset: 'error' });
      return;
    }

    try {
      if (initial !== undefined) {
        await updateMutation.mutateAsync({
          id: initial.id,
          data: { templateId, quantity: parsedQuantity },
        });
        burnt.toast({ title: '수정했어요', preset: 'done' });
      } else {
        await createMutation.mutateAsync({
          data: { gymId, templateId, quantity: parsedQuantity },
        });
        burnt.toast({ title: '머신을 추가했어요', preset: 'done' });
      }
      await queryClient.invalidateQueries({ queryKey: getListMachinesQueryKey(gymId) });
      onDone();
    } catch (err) {
      captureError(err);
      burnt.toast({ title: '저장에 실패했어요', preset: 'error' });
    }
  }

  if (templatesQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const templates = templatesQuery.data ?? [];
  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <SafeAreaView className="flex-1 bg-bg-base px-6 py-6 gap-4">
      <AppText className="text-headline font-bold text-text-primary">
        {isEdit ? '머신 수정' : '머신 추가'}
      </AppText>

      <View className="gap-2">
        <AppText className="text-body-sm font-medium text-text-secondary">머신 종류</AppText>
        <View className="rounded-lg bg-bg-elevated p-3 gap-2">
          {templates.slice(0, 30).map((template) => (
            <Button
              key={template.id}
              label={`${template.brandName} ${template.name}`}
              variant={templateId === template.id ? 'primary' : 'secondary'}
              onPress={() => {
                setTemplateId(template.id);
              }}
            />
          ))}
        </View>
        {selectedTemplate ? (
          <AppText className="text-caption text-text-tertiary">
            선택됨: {selectedTemplate.brandName} {selectedTemplate.name}
          </AppText>
        ) : null}
      </View>

      <View className="gap-2">
        <AppText className="text-body-sm font-medium text-text-secondary">수량</AppText>
        <TextInput
          accessibilityLabel="수량 입력"
          keyboardType="number-pad"
          value={quantityText}
          onChangeText={setQuantityText}
          className="rounded-lg bg-bg-elevated px-4 py-3 text-body text-text-primary"
          testID="quantity-input"
        />
      </View>

      <Button
        label={isEdit ? '수정 저장' : '추가하기'}
        variant="primary"
        loading={isPending}
        onPress={() => {
          void handleSubmit();
        }}
      />
    </SafeAreaView>
  );
}
