import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, CURSOR_THROTTLE_MS, OBJECT_THROTTLE_MS } from "../constants";

describe("constants", () => {
  it("MIN_ZOOM is a positive number less than 1", () => {
    expect(MIN_ZOOM).toBe(0.1);
    expect(MIN_ZOOM).toBeGreaterThan(0);
    expect(MIN_ZOOM).toBeLessThan(1);
  });

  it("MAX_ZOOM is greater than 1", () => {
    expect(MAX_ZOOM).toBe(5);
    expect(MAX_ZOOM).toBeGreaterThan(1);
  });

  it("MAX_ZOOM is greater than MIN_ZOOM", () => {
    expect(MAX_ZOOM).toBeGreaterThan(MIN_ZOOM);
  });

  it("ZOOM_STEP is slightly above 1 for incremental zoom", () => {
    expect(ZOOM_STEP).toBe(1.1);
    expect(ZOOM_STEP).toBeGreaterThan(1);
    expect(ZOOM_STEP).toBeLessThan(2);
  });

  it("CURSOR_THROTTLE_MS is a reasonable throttle value", () => {
    expect(CURSOR_THROTTLE_MS).toBe(50);
    expect(CURSOR_THROTTLE_MS).toBeGreaterThan(0);
    expect(CURSOR_THROTTLE_MS).toBeLessThanOrEqual(200);
  });

  it("OBJECT_THROTTLE_MS is a reasonable throttle value", () => {
    expect(OBJECT_THROTTLE_MS).toBe(100);
    expect(OBJECT_THROTTLE_MS).toBeGreaterThan(0);
    expect(OBJECT_THROTTLE_MS).toBeLessThanOrEqual(500);
  });

  it("OBJECT_THROTTLE_MS is >= CURSOR_THROTTLE_MS", () => {
    expect(OBJECT_THROTTLE_MS).toBeGreaterThanOrEqual(CURSOR_THROTTLE_MS);
  });
});
