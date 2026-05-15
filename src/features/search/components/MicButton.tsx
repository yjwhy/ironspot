import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';

import { useVoiceInput } from '../hooks/useVoiceInput';

interface MicButtonProps {
  /** Fired whenever the recognizer produces a transcript (partial or final). */
  onTranscript: (transcript: string) => void;
  /** Optional callback when voice input ends — useful for parent to refocus input. */
  onEnd?: () => void;
}

export function MicButton({ onTranscript, onEnd }: MicButtonProps) {
  const { isListening, transcript, error, start, stop } = useVoiceInput();
  const pulse = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  useEffect(
    function syncPulseToListeningState() {
      if (isListening && !reduceMotion) {
        pulse.value = withRepeat(withTiming(1.3, { duration: 600 }), -1, true);
      } else {
        cancelAnimation(pulse);
        pulse.value = withTiming(1, { duration: 200 });
      }
    },
    [isListening, reduceMotion, pulse],
  );

  useEffect(
    function forwardTranscriptUpward() {
      if (transcript !== '') {
        onTranscript(transcript);
      }
    },
    [transcript, onTranscript],
  );

  useEffect(
    function notifyParentOnEnd() {
      if (!isListening && onEnd !== undefined) {
        onEnd();
      }
    },
    [isListening, onEnd],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  function handlePress() {
    if (isListening) {
      stop();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void start();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={pressedOpacity}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isListening ? '음성 입력 중지' : '음성으로 검색'}
      accessibilityState={{ busy: isListening }}
      testID="mic-button"
    >
      <Animated.View style={animatedStyle}>
        <MaterialIcons
          name={isListening ? 'mic' : 'mic-none'}
          size={22}
          color={
            error !== null
              ? colors.error
              : isListening
                ? colors.accent.DEFAULT
                : colors.text.secondary
          }
        />
      </Animated.View>
    </Pressable>
  );
}

function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(function subscribeReduceMotion() {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
