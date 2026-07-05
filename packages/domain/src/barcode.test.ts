import { describe, expect, it } from "vitest";
import { EXTRACTION_SCHEMA_VERSION, parseAamvaPdf417Payload, parseDriverLicenseText, mergeBarcodeIntoExtraction } from "./index";

describe("AAMVA PDF417 barcode parsing", () => {
  it("parses the fields commonly stored in a driver license barcode", () => {
    const result = parseAamvaPdf417Payload(`@
ANSI 636000090002DL00410288ZA03290015DLDAQD12345678
DCSMORGAN
DACAVERY
DADQUINN
DBB04071956
DBD04072006
DBA04072032
DAG123 SAMPLE DRIVE
DAIINDIANAPOLIS
DAJIN
DAK462040000
DCAOperator
DCBAD
DCDM
DBC1
DAU508
DAW165
DAYBRO
DAZBRO`);

    expect(result.format).toBe("AAMVA_PDF417");
    expect(result.parsed).toMatchObject({
      fullName: "AVERY QUINN MORGAN",
      licenseNumber: "D12345678",
      issuingState: "IN",
      dateOfBirth: "1956-04-07",
      issueDate: "2006-04-07",
      expirationDate: "2032-04-07",
      address: "123 SAMPLE DRIVE, INDIANAPOLIS, IN 462040000",
      licenseClass: "Operator",
      restrictions: ["AD"],
      endorsements: ["M"],
      sex: "M",
      height: "508",
      weight: "165",
      eyeColor: "BRO",
      hairColor: "BRO"
    });
  });

  it("lets barcode values upgrade parser confidence and fill missing OCR fields", () => {
    const extraction = parseDriverLicenseText({
      documentType: "LicenseFront",
      text: "Full Name: Avery Sample\nIssuing State: IN\nConfidence: 0.66"
    });
    const barcode = parseAamvaPdf417Payload("DAQD12345678\nDBB04071956\nDBA04072032\nDAJIN");
    const merged = mergeBarcodeIntoExtraction(extraction, barcode);

    expect(merged.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(merged.licenseNumber).toBe("D12345678");
    expect(merged.dateOfBirth).toBe("1956-04-07");
    expect(merged.fieldConfidences.find((item) => item.field === "licenseNumber")).toMatchObject({
      source: "barcode",
      confidence: 0.98,
      needsAdjudication: false
    });
  });
});
