import {
  parseDriverLicenseText,
  StructuredExtractionAdapter,
  StructuredExtractionInput,
  StructuredLicenseExtraction
} from "@driverslicense/domain";

export class DeterministicStructuredExtractionAdapter implements StructuredExtractionAdapter {
  async extractFields(input: StructuredExtractionInput): Promise<StructuredLicenseExtraction> {
    return parseDriverLicenseText({
      text: input.ocrText,
      documentType: input.documentType,
      ocrResult: input.ocrResult
    });
  }
}
