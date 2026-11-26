/* global jest */
// react-native-gesture-handler v3's GestureDetector installs native UI-runtime
// bindings on mount, which throw under Jest's web worklets runtime
// (`[Worklets] getUIRuntimeHolder is not supported on web`) and otherwise
// demand a GestureHandlerRootView ancestor. The library's own jestSetup mocks
// the native module (which @gorhom/bottom-sheet and the real ScrollView /
// GestureHandlerRootView still rely on), so we keep it.
require('react-native-gesture-handler/jestSetup');

// On import, gesture-handler's reanimatedWrapper calls
// installUIRuntimeBindings(Worklets.getUIRuntimeHolder) in a microtask, and
// react-native-worklets' getUIRuntimeHolder throws `not supported on web`
// under Jest (jest-expo resolves the native variant, not the web one), failing
// the suite asynchronously. Override only that one export at its source so the
// binding resolves to a no-op regardless of which import path triggers it.
jest.mock('react-native-worklets', () => {
  const actual = jest.requireActual('react-native-worklets');
  return { ...actual, getUIRuntimeHolder: () => ({}) };
});

// GestureDetector still requires a GestureHandlerRootView ancestor that the
// gesture tests do not render, and the Gesture builder constructs real worklet
// gestures. Replace just those two: GestureDetector renders its child directly,
// and Gesture is a no-op chainable so .onUpdate().onEnd() and the
// Exclusive/Simultaneous composers resolve without worklets. Everything else
// (GestureHandlerRootView, ScrollView for bottom-sheet) stays real. The gesture
// tests assert rendering and accessibility only; real gesture behaviour is
// verified on device.
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const ReactLocal = require('react');

  function GestureDetector({ children }) {
    return ReactLocal.createElement(ReactLocal.Fragment, null, children);
  }

  function createChainableGesture() {
    return new Proxy(function noopGesture() {}, {
      get() {
        return () => createChainableGesture();
      },
      apply() {
        return createChainableGesture();
      },
    });
  }

  const Gesture = new Proxy(
    {},
    {
      get() {
        return () => createChainableGesture();
      },
    },
  );

  return { ...actual, GestureDetector, Gesture };
});

// @react-native-community/netinfo 12's InternetReachability.update dereferences
// an unconfigured internal config under Jest (TypeError: reading
// 'isInternetReachable' of undefined). Use the library's bundled Jest mock for
// a stable NetInfo stub.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);
