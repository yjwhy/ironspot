// react-native-worklets@0.7+ throws at require time when the native module is
// absent (i.e. in Jest). Mock it before reanimated pulls it in.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
