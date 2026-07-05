import { describe, expect, it } from "vitest";
import { parseDriverLicenseText } from "./parser";

describe("parseDriverLicenseText", () => {
  it("extracts normalized license fields from synthetic text", () => {
    const extraction = parseDriverLicenseText({
      documentType: "LicenseFront",
      referenceDate: "2026-07-04T00:00:00.000Z",
      text: `
        Full Name: Jordan Avery Sample
        License Number: OH1234567
        Issuing State: OH
        Date of Birth: 09/12/1990
        Issue Date: 07/01/2026
        Expiration Date: 07/01/2030
        Address: 100 Sample Lane, Columbus, OH
        License Class: D
        Endorsements: M
        Restrictions: Corrective lenses
        Sex: X
        Height: 5-09
        Eye Color: BRO
        Organ Donor: Yes
        Veteran: No
        REAL ID: Yes
        Confidence: 0.91
      `
    });

    expect(extraction).toMatchObject({
      fullName: "Jordan Avery Sample",
      licenseNumber: "OH1234567",
      issuingState: "OH",
      dateOfBirth: "1990-09-12",
      issueDate: "2026-07-01",
      expirationDate: "2030-07-01",
      address: "100 Sample Lane, Columbus, OH",
      licenseClass: "D",
      endorsements: ["M"],
      restrictions: ["Corrective lenses"],
      organDonor: true,
      veteran: false,
      realId: true,
      ageAtScan: 35,
      isExpired: false,
      confidenceScore: 0.91
    });
  });

  it("recovers fields when OCR splits visual columns into separate lines", () => {
    const extraction = parseDriverLicenseText({
      documentType: "LicenseFront",
      referenceDate: "2026-07-04T00:00:00.000Z",
      text: `
        FULL NAME
        SEX
        Jordan Avery Sample
        X
        LICENSE NUMBER
        OH1234567
        ISSUING STATE
        EYE COLOR
        OH
        BRO
        DATE OF BIRTH
        1990-09-12
        ISSUE
        DATE
        ADDRESS 2030-07-01 2026-07-01 EXPIRATION 100 Sample DATE Lane, Columbus, OH
        REAL ID
        Yes
        CONFIDENCE
        0.91
      `
    });

    expect(extraction).toMatchObject({
      fullName: "Jordan Avery Sample",
      licenseNumber: "OH1234567",
      issuingState: "OH",
      dateOfBirth: "1990-09-12",
      issueDate: "2026-07-01",
      expirationDate: "2030-07-01",
      realId: true,
      confidenceScore: 0.91
    });
  });

  it("extracts compact DMV field-code layouts", () => {
    const extraction = parseDriverLicenseText({
      documentType: "LicenseFront",
      referenceDate: "2026-07-04T00:00:00.000Z",
      ocrResult: {
        text: "",
        confidenceScore: 0.97,
        raw: {}
      },
      text: `
        IN USA
        INDIANA
        bmv.IN.gov
        OPERATOR DRIVER LICENSE
        RONALD R STIVER COMMISSIONER
        023
        4d DLN 1234-56-7890
        DIGIMARC SAMPLE
        4a Iss 04/07/2006 4b Exp 04/07/2012
        DONOR
        1 SAMPLE
        2 AVERY
        SEAL
        OF OF INDIANA
        8 123 SAMPLE DRIVE
        APT B
        INDIANAPOLIS, IN 46204-0000
        9 Class
        15 Sex M
        9a End P
        16, Hgt 5-08
        Avery Sample
        12 Res AD
        17 Wgt 165
        3 DOB 04/07/1956
        18 Eyes BRO
        5 Transaction 04070602300001 19 Hair BRO
      `
    });

    expect(extraction).toMatchObject({
      fullName: "Avery Sample",
      licenseNumber: "1234-56-7890",
      issuingState: "IN",
      dateOfBirth: "1956-04-07",
      issueDate: "2006-04-07",
      expirationDate: "2012-04-07",
      address: "123 Sample Drive, APT B, Indianapolis, IN 46204-0000",
      licenseClass: null,
      endorsements: ["P"],
      restrictions: ["AD"],
      sex: "M",
      height: "5-08",
      weight: "165",
      eyeColor: "BRO",
      hairColor: "BRO",
      organDonor: true,
      realId: null,
      ageAtScan: 70,
      isExpired: true,
      confidenceScore: 0.97
    });
  });
});
