/**
 * Wraps a `useXxx` Orval mutation jest.Mock to capture the options the
 * domain hook passes in (onSuccess / onError callbacks) and expose a
 * `mutate` spy that the hook calls. Generic over the captured shape so
 * each mutation test can declare its own callback signatures — the lint
 * sees TOptions as one-shot because the input is `jest.Mock`, but the
 * generic is load-bearing for the caller's `getOptions()` chain.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function captureMutation<TOptions>(hookMock: jest.Mock): {
  mutate: jest.Mock;
  getOptions: () => TOptions | undefined;
} {
  const mutate = jest.fn();
  let captured: TOptions | undefined;
  hookMock.mockImplementation((options: TOptions) => {
    captured = options;
    return { mutate, isPending: false };
  });
  return { mutate, getOptions: () => captured };
}
