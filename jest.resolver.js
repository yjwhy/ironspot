// Reanimated 4 and react-native-worklets eagerly initialise a native runtime
// the moment they are imported (worklets' `loadUnpackersWithCode`), which has
// no native backing under Jest and throws at module evaluation. Reanimated
// ships a Jest resolver that redirects its own and worklets' modules to their
// web variants (no native init) by stripping `.native` extensions.
//
// jest-expo relies on @react-native/jest-preset's resolver to strip React
// Native's `exports` map under Jest 30 (jest-expo preset NOTE), so we cannot
// simply replace the resolver with Reanimated's. We compose them as a chain:
//
//   reanimatedResolver -> @react-native resolver -> Jest's built-in resolver
//
// Each wrapper does its own rewriting, then delegates to the next via
// `options.defaultResolver`. Both the RN resolver and Jest's built-in perform
// real filesystem lookups, so the RN resolver must keep Jest's built-in as its
// fallback (not itself), otherwise paths like the preset's asset transformer
// fail to resolve.
const reanimatedResolver = require('react-native-reanimated/jest/resolver');
const rnResolver = require('@react-native/jest-preset/jest/resolver');

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const jestDefaultResolver = options.defaultResolver;
  function rnResolverWithJestFallback(innerRequest, innerOptions) {
    return rnResolver(innerRequest, {
      ...innerOptions,
      defaultResolver: jestDefaultResolver,
    });
  }
  return reanimatedResolver(request, {
    ...options,
    defaultResolver: rnResolverWithJestFallback,
  });
};
