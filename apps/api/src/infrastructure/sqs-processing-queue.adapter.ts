import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { DocumentProcessingJobMessage, DocumentProcessingQueue } from "@driverslicense/domain";

export class SqsProcessingQueueAdapter implements DocumentProcessingQueue {
  readonly mode = "external" as const;
  private readonly queueUrl = requiredEnv("PROCESSING_QUEUE_URL");
  private readonly client = new SQSClient({
    region: process.env.AWS_REGION ?? "us-east-2"
  });

  async enqueue(input: DocumentProcessingJobMessage) {
    const response = await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(input)
      })
    );

    return {
      messageId: response.MessageId ?? "sqs-message",
      enqueuedAt: new Date().toISOString()
    };
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for SQS processing mode.`);
  }

  return value;
}
