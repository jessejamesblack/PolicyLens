import { DetectDocumentTextCommand, TextractClient } from "@aws-sdk/client-textract";
import { DocumentOcrAdapter, ExtractTextInput, OcrResult } from "@driverslicense/domain";

export class TextractOcrAdapter implements DocumentOcrAdapter {
  private readonly client = new TextractClient({
    region: process.env.AWS_REGION ?? "us-east-2"
  });

  async extractText(input: ExtractTextInput): Promise<OcrResult> {
    if (!input.bytes) {
      throw new Error("Textract adapter requires document bytes for synchronous processing.");
    }

    const response = await this.client.send(
      new DetectDocumentTextCommand({
        Document: {
          Bytes: Buffer.from(input.bytes)
        }
      })
    );
    const lines = response.Blocks?.filter((block) => block.BlockType === "LINE" && block.Text) ?? [];
    const confidenceScore = lines.length
      ? lines.reduce((sum, line) => sum + (line.Confidence ?? 0), 0) / lines.length / 100
      : 0;

    return {
      text: lines.map((line) => line.Text).join("\n"),
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      raw: response
    };
  }
}
