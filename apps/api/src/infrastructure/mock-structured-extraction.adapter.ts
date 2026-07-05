import {
  StructuredExtractionAdapter,
  StructuredExtractionInput,
  StructuredLicenseExtraction
} from "@driverslicense/domain";
import { DeterministicStructuredExtractionAdapter } from "./deterministic-structured-extraction.adapter";

export class MockStructuredExtractionAdapter implements StructuredExtractionAdapter {
  private readonly deterministic = new DeterministicStructuredExtractionAdapter();

  async extractFields(input: StructuredExtractionInput): Promise<StructuredLicenseExtraction> {
    return this.deterministic.extractFields(input);
  }
}
