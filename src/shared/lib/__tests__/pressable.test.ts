import { pressedOpacity } from '../pressable';

describe('pressedOpacity', () => {
  it('returns opacity 0.8 when pressed is true', () => {
    expect(pressedOpacity({ pressed: true })).toEqual({ opacity: 0.8 });
  });

  it('returns opacity 1 when pressed is false', () => {
    expect(pressedOpacity({ pressed: false })).toEqual({ opacity: 1 });
  });
});
