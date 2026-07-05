import { DocumentProcessingJobMessage, DocumentProcessingQueue } from "@driverslicense/domain";
import { randomUUID } from "node:crypto";

export class LocalProcessingQueueAdapter implements DocumentProcessingQueue {
  readonly mode = "inline" as const;

  async enqueue(_input: DocumentProcessingJobMessage) {
    return {
      messageId: `local-${randomUUID()}`,
      enqueuedAt: new Date().toISOString()
    };
  }
}
