import {
  mergeBarcodeIntoExtraction,
  parseDriverLicenseText,
  StructuredExtractionAdapter,
  StructuredExtractionInput,
  StructuredLicenseExtraction
} from "@driverslicense/domain";

export class DeterministicStructuredExtractionAdapter implements StructuredExtractionAdapter {
  async extractFields(input: StructuredExtractionInput): Promise<StructuredLicenseExtraction> {
    const extraction = parseDriverLicenseText({
      text: input.ocrText,
      documentType: input.documentType,
      ocrResult: input.ocrResult
    });

    return mergeBarcodeIntoExtraction(extraction, input.barcodeResult);
  }
}
