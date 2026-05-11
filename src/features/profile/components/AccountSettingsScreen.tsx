import { MaterialIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { userKeys } from '@/features/auth/query-keys';
import { AUTH_ROUTES } from '@/features/auth/routes';
import { AppText } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { useDeleteMe, useUpdateMe } from '@/shared/generated/users/users';
import { pressedOpacity } from '@/shared/lib/pressable';
import { supabase } from '@/shared/lib/supabase';
import { colors } from '@/shared/theme/tokens';

const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 20;
const HEADER_ICON_SIZE = 24;
const PENDING_OPACITY = 0.5;

const TOAST_UPDATE_SUCCESS = '닉네임이 변경되었습니다';
const TOAST_UPDATE_ERROR = '변경에 실패했습니다';
const TOAST_DELETE_SUCCESS = '계정이 삭제되었습니다';
const TOAST_DELETE_ERROR = '삭제에 실패했습니다';
const TOAST_NICKNAME_INVALID = '닉네임은 2~20자여야 합니다';

const DELETE_ALERT_TITLE = '계정을 삭제하시겠어요?';
const DELETE_ALERT_MESSAGE =
  '계정과 추천 기록이 영구 삭제됩니다.\n업로드한 사진은 익명으로 헬스장 데이터에 남습니다.\n되돌릴 수 없습니다.';

export function AccountSettingsScreen() {
  const userQuery = useCurrentUser();
  const queryClient = useQueryClient();
  const user = userQuery.data;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const updateMutation = useUpdateMe({
    mutation: {
      onSuccess: function handleUpdateSuccess() {
        void queryClient.invalidateQueries({ queryKey: userKeys.all });
        setIsEditing(false);
        burnt.toast({ title: TOAST_UPDATE_SUCCESS, preset: 'done' });
      },
      onError: function handleUpdateError() {
        burnt.toast({ title: TOAST_UPDATE_ERROR, preset: 'error' });
      },
    },
  });

  const deleteMutation = useDeleteMe({
    mutation: {
      onSuccess: async function handleDeleteSuccess() {
        const { error: signOutError } = await supabase.auth.signOut();
        queryClient.clear();
        burnt.toast({
          title: signOutError ? TOAST_DELETE_ERROR : TOAST_DELETE_SUCCESS,
          preset: signOutError ? 'error' : 'done',
        });
        router.replace(AUTH_ROUTES.login);
      },
      onError: function handleDeleteError() {
        burnt.toast({ title: TOAST_DELETE_ERROR, preset: 'error' });
      },
    },
  });

  function handleStartEdit() {
    setDraft(user?.nickname ?? '');
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
  }

  function handleSaveNickname() {
    if (updateMutation.isPending) return;
    const trimmed = draft.trim();
    const isNicknameInvalid =
      trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH;
    if (isNicknameInvalid) {
      burnt.toast({ title: TOAST_NICKNAME_INVALID, preset: 'error' });
      return;
    }
    updateMutation.mutate({ data: { nickname: trimmed } });
  }

  function handleDeleteAccountPress() {
    Alert.alert(DELETE_ALERT_TITLE, DELETE_ALERT_MESSAGE, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: function confirmDelete() {
          deleteMutation.mutate(undefined);
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base" testID="account-settings-screen">
      <Header title="계정 설정" onBack={router.back} />

      <NicknameRow
        nickname={user?.nickname ?? ''}
        isEditing={isEditing}
        draft={draft}
        isSaving={updateMutation.isPending}
        onChangeDraft={setDraft}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveNickname={handleSaveNickname}
      />

      <ConnectedAccountRow email={user?.email ?? ''} />

      <DeleteAccountButton
        onPress={handleDeleteAccountPress}
        isPending={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}

interface HeaderProps {
  title: string;
  onBack: () => void;
}

function Header({ title, onBack }: HeaderProps) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border-DEFAULT">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        style={pressedOpacity}
        className="pr-3"
      >
        <MaterialIcons
          name="arrow-back"
          size={HEADER_ICON_SIZE}
          color={colors.text.primary}
          importantForAccessibility="no"
          accessibilityElementsHidden={true}
        />
      </Pressable>
      <AppText accessibilityRole="header" className="text-heading-sm text-text-primary">
        {title}
      </AppText>
    </View>
  );
}

interface NicknameRowProps {
  nickname: string;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onChangeDraft: (next: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveNickname: () => void;
}

function NicknameRow({
  nickname,
  isEditing,
  draft,
  isSaving,
  onChangeDraft,
  onStartEdit,
  onCancelEdit,
  onSaveNickname,
}: NicknameRowProps) {
  return (
    <View className="px-4 py-4 border-b border-border-DEFAULT">
      <AppText className="text-body-sm text-text-secondary mb-2">닉네임</AppText>
      {isEditing ? (
        <NicknameEditMode
          draft={draft}
          isSaving={isSaving}
          onChangeDraft={onChangeDraft}
          onSaveNickname={onSaveNickname}
          onCancelEdit={onCancelEdit}
        />
      ) : (
        <NicknameDisplayMode nickname={nickname} onStartEdit={onStartEdit} />
      )}
    </View>
  );
}

interface NicknameEditModeProps {
  draft: string;
  isSaving: boolean;
  onChangeDraft: (next: string) => void;
  onSaveNickname: () => void;
  onCancelEdit: () => void;
}

function NicknameEditMode({
  draft,
  isSaving,
  onChangeDraft,
  onSaveNickname,
  onCancelEdit,
}: NicknameEditModeProps) {
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={draft}
        onChangeText={onChangeDraft}
        className="flex-1 border border-border-focus rounded-md px-3 py-2 text-body"
        maxLength={NICKNAME_MAX_LENGTH}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onSaveNickname}
        accessibilityLabel="닉네임 입력"
      />
      <Button label="저장" size="sm" onPress={onSaveNickname} loading={isSaving} />
      <Button label="취소" size="sm" variant="ghost" onPress={onCancelEdit} disabled={isSaving} />
    </View>
  );
}

interface NicknameDisplayModeProps {
  nickname: string;
  onStartEdit: () => void;
}

function NicknameDisplayMode({ nickname, onStartEdit }: NicknameDisplayModeProps) {
  return (
    <View className="flex-row items-center justify-between">
      <AppText className="text-body">{nickname}</AppText>
      <Pressable
        onPress={onStartEdit}
        accessibilityRole="button"
        accessibilityLabel="닉네임 수정"
        style={pressedOpacity}
      >
        <AppText className="text-body-sm text-accent">수정</AppText>
      </Pressable>
    </View>
  );
}

interface ConnectedAccountRowProps {
  email: string;
}

function ConnectedAccountRow({ email }: ConnectedAccountRowProps) {
  return (
    <View className="px-4 py-4 border-b border-border-DEFAULT">
      <AppText className="text-body-sm text-text-secondary mb-2">연결된 계정</AppText>
      <AppText className="text-body">{email}</AppText>
    </View>
  );
}

interface DeleteAccountButtonProps {
  onPress: () => void;
  isPending: boolean;
}

function DeleteAccountButton({ onPress, isPending }: DeleteAccountButtonProps) {
  return (
    <View className="flex-1 justify-end px-4 pb-8">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="계정 삭제"
        style={isPending ? { opacity: PENDING_OPACITY } : pressedOpacity}
        className="items-center py-3"
        disabled={isPending}
      >
        <AppText className="text-body text-error">계정 삭제</AppText>
      </Pressable>
    </View>
  );
}
