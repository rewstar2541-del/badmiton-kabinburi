import { describe, expect, it } from "vitest";
import { crc16, promptPayPayload } from "../promptpay";

describe("promptpay", () => {
  it("crc16 ccitt-false", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("เบอร์มือถือพร้อมยอดเงิน", () => {
    expect(promptPayPayload("081-234-5678", 185)).toBe(
      "00020101021229370016A000000677010111011300668123456785802TH53037645406185.006304DACB",
    );
  });

  it("เลขบัตรประชาชนไม่ระบุยอด", () => {
    expect(promptPayPayload("1234567890123")).toBe(
      "00020101021129370016A000000677010111021312345678901235802TH53037646304EC40",
    );
  });
});
