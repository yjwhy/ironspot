import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';

import { MachinePicker, type MachinePickerSelection } from './MachinePicker';
import { UPLOAD_MACHINE_PHOTO_PATHNAME } from '../constants';

// Phase 5 follow-up G manual-input path: user picks the brand+template (or
// types a free-form name) without ever capturing a label photo. Reuses
// MachinePicker — the same component the OCR-fail fallback uses — so the
// underlying UI / search / closed-list-vs-free-form rules stay consistent
// across both fallback and explicit-manual paths.
//
// On submit the screen forwards the selection (JSON-serialised) to the
// whole-machine capture screen, which then runs the standard upload +
// register pipeline.
export function UploadManualInputScreen() {
  const router = useRouter();
  const { gymId, naverPlace } = useLocalSearchParams<{
    gymId?: string;
    naverPlace?: string;
  }>();

  const [selection, setSelection] = useState<MachinePickerSelection>({ kind: 'none' });

  const canProceed = canProceedSelection(selection);

  function handleNext() {
    if (!canProceed) return;
    router.push({
      pathname: UPLOAD_MACHINE_PHOTO_PATHNAME,
      params: {
        gymId,
        naverPlace,
        selection: JSON.stringify(selection),
      },
    });
  }

  return (
    <View className="flex-1 bg-bg-base p-4">
      <AppText className="mb-2 text-h2 font-semibold text-text-primary">어떤 기구인가요?</AppText>
      <AppText className="mb-4 text-body-sm text-text-secondary">
        브랜드와 기구 종류를 선택해주세요
      </AppText>

      <View className="flex-1">
        <MachinePicker value={selection} onChange={setSelection} />
      </View>

      <Button
        testID="upload-manual-next"
        label="다음"
        onPress={handleNext}
        disabled={!canProceed}
      />
    </View>
  );
}

function canProceedSelection(selection: MachinePickerSelection): boolean {
  if (selection.kind === 'template') return true;
  if (selection.kind === 'freeForm') return selection.text.trim() !== '';
  return false;
}
