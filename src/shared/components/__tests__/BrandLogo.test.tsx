import { render } from '@testing-library/react-native';

import { BRAND_LOGOS, BrandLogo } from '../BrandLogo';

describe('BrandLogo', () => {
  afterEach(() => {
    // Tests freely mutate the registry to exercise the bitmap branch.
    // Reset between cases so accidental cross-test bleed is impossible.
    for (const key of Object.keys(BRAND_LOGOS)) {
      Reflect.deleteProperty(BRAND_LOGOS, key);
    }
  });

  it('renders monogram fallback (first nameKo char) when no asset is registered', () => {
    const { getByLabelText } = render(
      <BrandLogo
        brandId="b0000001-0000-0000-0000-000000000001"
        brandName="Panatta"
        brandNameKo="파나타"
      />,
    );
    expect(getByLabelText('Panatta 로고 자리 (파)')).toBeTruthy();
  });

  it('falls back to English name when nameKo is empty', () => {
    const { getByLabelText } = render(<BrandLogo brandId="b-x" brandName="Cybex" brandNameKo="" />);
    expect(getByLabelText('Cybex 로고 자리 (C)')).toBeTruthy();
  });

  it('renders bitmap when BRAND_LOGOS has an entry for the brand', () => {
    const sentinel = { uri: 'file:///fake-asset.png' };
    BRAND_LOGOS['b-with-asset'] = sentinel;

    const { getByLabelText } = render(
      <BrandLogo brandId="b-with-asset" brandName="Hammer Strength" brandNameKo="해머스트렝스" />,
    );
    expect(getByLabelText('Hammer Strength 로고')).toBeTruthy();
  });

  it('assigns the same monogram colour to the same brandId across renders', () => {
    const first = render(
      <BrandLogo brandId="b-same" brandName="X" brandNameKo="엑" testID="logo-1" />,
    );
    const second = render(
      <BrandLogo brandId="b-same" brandName="X" brandNameKo="엑" testID="logo-2" />,
    );
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    const c1 = first.getByTestId('logo-1').props.style.backgroundColor as string;
    const c2 = second.getByTestId('logo-2').props.style.backgroundColor as string;
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    expect(c1).toBe(c2);
  });

  it.each([
    ['sm', 20],
    ['md', 28],
    ['lg', 40],
  ] as const)('sizes the monogram square at the contextual footprint for %s', (size, px) => {
    const { getByTestId } = render(
      <BrandLogo brandId="b-size" brandName="X" brandNameKo="엑" size={size} testID="logo" />,
    );
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    const style = getByTestId('logo').props.style as { width: number; height: number };
    expect(style.width).toBe(px);
    expect(style.height).toBe(px);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  });
});
