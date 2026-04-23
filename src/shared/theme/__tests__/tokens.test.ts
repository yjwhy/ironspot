import { colors, spacing, radius, ANIMATION } from '../tokens';

describe('theme tokens', () => {
  it('exposes amber accent color', () => {
    expect(colors.accent.DEFAULT).toBe('#F59E0B');
  });

  it('exposes consistent spacing scale', () => {
    expect(spacing.lg).toBe(16);
  });

  it('exposes stagger timing for animations', () => {
    expect(ANIMATION.stagger).toBe(60);
  });

  it('exposes radius scale', () => {
    expect(radius.md).toBe(12);
  });
});
