import { DocumentOcrAdapter, ExtractTextInput, OcrResult } from "@driverslicense/domain";

export class MockOcrAdapter implements DocumentOcrAdapter {
  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    const decodedText = input.bytes ? Buffer.from(input.bytes).toString("utf8") : "";
    const text = looksLikePlainText(decodedText) ? decodedText : fallbackText(input);
    const lines = text.split(/\r?\n/).filter(Boolean);

    return {
      text,
      confidenceScore: inferConfidence(text),
      raw: {
        adapter: "mock",
        filename: input.filename,
        lineCount: lines.length,
        blocks: lines.map((line, index) => ({
          blockType: "LINE",
          text: line,
          confidence: 95 - index * 0.25
        }))
      }
    };
  }
}

function looksLikePlainText(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed || trimmed.startsWith("%PDF")) {
    return false;
  }

  const printable = trimmed.replace(/[^\x20-\x7E\r\n\t]/g, "");
  return printable.length / trimmed.length > 0.85;
}

function inferConfidence(text: string): number {
  const match = text.match(/Confidence\s*[:\-]\s*(0?\.\d+|1(?:\.0)?|\d{1,3}%)/i);

  if (!match?.[1]) {
    return 0.86;
  }

  if (match[1].endsWith("%")) {
    return Number(match[1].replace("%", "")) / 100;
  }

  return Number(match[1]);
}

function fallbackText(input: ExtractTextInput): string {
  const filename = input.filename.toLowerCase();

  if (filename.includes("texas") || filename.includes("under-21")) {
    return `SYNTHETIC SAMPLE - NOT A GOVERNMENT ID
Full Name: Riley Morgan Sample
License Number: TX8844221
Issuing State: TX
Date of Birth: 2008-08-20
Issue Date: 2025-08-20
Expiration Date: 2030-08-20
Address: 200 Demo Road, Austin, TX
License Class: C
Endorsements: None
Restrictions: Under 21, Corrective lenses
Sex: F
Height: 5-05
Eye Color: HAZ
Organ Donor: No
Veteran: No
REAL ID: Yes
Under 21 Until: 2029-08-20
Confidence: 0.88`;
  }

  if (filename.includes("california") || filename.includes("expired")) {
    return `SYNTHETIC SAMPLE - NOT A GOVERNMENT ID
Full Name: Casey Rivera Sample
License Number: CA5522109
Issuing State: CA
Date of Birth: 1984-03-14
Issue Date: 2018-03-14
Expiration Date: 2024-03-14
Address: 300 Example Avenue, Sacramento, CA
License Class: C
Endorsements: None
Restrictions: None
Sex: X
Height: 5-10
Eye Color: GRN
Organ Donor: Yes
Veteran: No
REAL ID: No
Confidence: 0.93`;
  }

  if (filename.includes("new-york") || filename.includes("temporary")) {
    return `SYNTHETIC SAMPLE - NOT A GOVERNMENT ID
Full Name: Avery Chen Sample
License Number: NY7711002
Issuing State: NY
Date of Birth: 1999-12-02
Issue Date: 2026-06-15
Expiration Date: 2026-09-15
Address: 400 Sample Street, Albany, NY
License Class: D
Endorsements: None
Restrictions: Temporary document, Photo pending
Sex: M
Height: 6-00
Eye Color: BLU
Organ Donor: No
Veteran: Yes
REAL ID: No
Confidence: 0.81`;
  }

  if (filename.includes("florida") || filename.includes("motorcycle")) {
    return `SYNTHETIC SAMPLE - NOT A GOVERNMENT ID
Full Name: Morgan Blake Sample
License Number: FL9033775
Issuing State: FL
Date of Birth: 1978-05-29
Issue Date: 2026-05-29
Expiration Date: 2034-05-29
Address: 500 Practice Parkway, Tallahassee, FL
License Class: E
Endorsements: Motorcycle
Restrictions: None
Sex: F
Height: 5-07
Eye Color: BRO
Organ Donor: Yes
Veteran: Yes
REAL ID: Yes
Confidence: 0.9`;
  }

  return `SYNTHETIC SAMPLE - NOT A GOVERNMENT ID
Full Name: Jordan Avery Sample
License Number: OH1234567
Issuing State: OH
Date of Birth: 1990-09-12
Issue Date: 2026-07-01
Expiration Date: 2030-07-01
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
Confidence: 0.91`;
}
