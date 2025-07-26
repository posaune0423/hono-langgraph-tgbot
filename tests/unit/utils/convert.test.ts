import { describe, expect, it } from "bun:test";
import { convertToString } from "../../../src/utils";

describe("convertToString", () => {
  it("should convert number to string", () => {
    expect(convertToString(42)).toBe("42");
    expect(convertToString(0)).toBe("0");
    expect(convertToString(-5)).toBe("-5");
    expect(convertToString(3.14159)).toBe("3.14159");
  });

  it("should convert undefined to null", () => {
    expect(convertToString(undefined)).toBe(null);
  });

  it("should handle edge cases", () => {
    expect(convertToString(NaN)).toBe("NaN");
    expect(convertToString(Infinity)).toBe("Infinity");
    expect(convertToString(-Infinity)).toBe("-Infinity");
  });

  it("should handle decimal numbers", () => {
    expect(convertToString(1.23456789)).toBe("1.23456789");
    expect(convertToString(0.0001)).toBe("0.0001");
    expect(convertToString(1e-10)).toBe("1e-10");
  });

  it("should handle large numbers", () => {
    expect(convertToString(1e20)).toBe("100000000000000000000");
    expect(convertToString(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991");
    expect(convertToString(Number.MIN_SAFE_INTEGER)).toBe("-9007199254740991");
  });
});
