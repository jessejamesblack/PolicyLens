import {
  DocumentBarcodeAdapter,
  emptyBarcodeResult,
  ExtractBarcodeInput,
  parseAamvaPdf417Payload
} from "@driverslicense/domain";

export class AamvaPdf417BarcodeAdapter implements DocumentBarcodeAdapter {
  async extractBarcode(input: ExtractBarcodeInput) {
    const payloadSources = [
      input.ocrText ?? "",
      input.bytes ? Buffer.from(input.bytes).toString("utf8") : ""
    ].filter(Boolean);

    for (const payloadSource of payloadSources) {
      const payload = findAamvaPayload(payloadSource);
      if (!payload) {
        continue;
      }

      const parsed = parseAamvaPdf417Payload(payload);
      if (parsed.parsed) {
        return parsed;
      }
    }

    return emptyBarcodeResult();
  }
}

function findAamvaPayload(value: string): string | null {
  if (!/ANSI|DAQ|DBA|DBB|DCS|DAC/.test(value)) {
    return null;
  }

  const lines = value
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const startIndex = lines.findIndex((line) => line.includes("ANSI") || /^[A-Z]{3}.+/.test(line));

  if (startIndex === -1) {
    return null;
  }

  return lines.slice(startIndex).join("\n");
}
