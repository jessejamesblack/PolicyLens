import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DocumentRecord, DocumentRepository, parseDocumentRecord } from "@driverslicense/domain";

export class DynamoDocumentRepository implements DocumentRepository {
  private readonly tableName = requiredEnv("DOCUMENT_TABLE_NAME");
  private readonly client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: process.env.AWS_REGION ?? "us-east-2"
    }),
    {
      marshallOptions: {
        removeUndefinedValues: true
      }
    }
  );

  async create(record: DocumentRecord): Promise<DocumentRecord> {
    await this.put(record);
    return record;
  }

  async update(record: DocumentRecord): Promise<DocumentRecord> {
    await this.put(record);
    return record;
  }

  async list(): Promise<DocumentRecord[]> {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName
      })
    );

    return (response.Items ?? [])
      .map((item) => parseDocumentRecord(item))
      .filter((record): record is DocumentRecord => record !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(documentId: string): Promise<DocumentRecord | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id: documentId }
      })
    );

    return response.Item ? parseDocumentRecord(response.Item) : null;
  }

  private async put(record: DocumentRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record
      })
    );
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for DynamoDB adapter mode.`);
  }

  return value;
}
