import { describe, expect, it } from 'vitest';
import { interpolatePosition } from './scroll-sync';

describe('scroll position interpolation', () => {
  const points = [
    { source: 0, target: 0 },
    { source: 50, target: 200 },
    { source: 100, target: 300 },
  ];

  it('interpolates between Markdown source anchors', () => {
    expect(interpolatePosition(points, 25)).toBe(100);
    expect(interpolatePosition(points, 75)).toBe(250);
  });
  it('clamps outside the source and supports no anchors', () => {
    expect(interpolatePosition(points, -2)).toBe(0);
    expect(interpolatePosition(points, 200)).toBe(300);
    expect(interpolatePosition([], 42)).toBe(0);
  });
});
