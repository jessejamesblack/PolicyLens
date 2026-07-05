<script lang="ts">
  import { goto } from "$app/navigation";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import Check from "@lucide/svelte/icons/check";
  import FileSearch from "@lucide/svelte/icons/file-search";
  import FileText from "@lucide/svelte/icons/file-text";
  import ScanLine from "@lucide/svelte/icons/scan-line";
  import Upload from "@lucide/svelte/icons/upload";
  import type { DocumentType } from "@driverslicense/domain";
  import { processDocument, uploadDocument } from "$lib/api";

  const DOCUMENT_TYPE_OPTIONS: DocumentType[] = ["LicenseFront", "LicenseBack", "TemporaryLicense", "LearnerPermit"];

  let selectedFile: File | null = null;
  let documentType: DocumentType = "LicenseFront";
  let isSubmitting = false;
  let errorMessage = "";

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    selectedFile = input.files?.[0] ?? null;
    errorMessage = "";
  }

  async function submit() {
    if (!selectedFile) {
      errorMessage = "Choose a synthetic license scan before submitting.";
      return;
    }

    isSubmitting = true;
    errorMessage = "";

    try {
      const upload = await uploadDocument(selectedFile, documentType);
      await processDocument(upload.documentId);
      await goto(`/documents/${upload.documentId}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Upload failed.";
    } finally {
      isSubmitting = false;
    }
  }

  function formatDocumentType(type: DocumentType): string {
    return type.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
</script>

<section class="page">
  <div class="page-header">
    <div>
      <p class="eyebrow">License capture</p>
      <h1>Scan and verify a driver license</h1>
      <p>Upload a synthetic license image or PDF, extract the visible fields, and validate the result for analytics.</p>
    </div>
  </div>

  <section class="workflow-card" aria-label="Capture workflow">
    <div class="workflow-header">
      <div>
        <p class="eyebrow">Step 1 of 3</p>
        <h2>Capture workflow</h2>
      </div>
      <span>0 / 1 uploaded</span>
    </div>
    <div class="workflow-steps">
      <div class="workflow-step active">
        <span><ScanLine size={17} /></span>
        <strong>Upload</strong>
      </div>
      <div class="workflow-step">
        <span><FileSearch size={17} /></span>
        <strong>Extract</strong>
      </div>
      <div class="workflow-step">
        <span><Check size={17} /></span>
        <strong>Validate</strong>
      </div>
    </div>
  </section>

  <div class="grid two">
    <section class="panel">
      <div class="panel-header">
        <h2>License upload</h2>
        <FileText size={20} class="muted" />
      </div>
      <div class="panel-body grid">
        {#if errorMessage}
          <div class="error"><AlertCircle size={17} /> {errorMessage}</div>
        {/if}

        <div class="field">
          <label for="documentType">Document type</label>
          <select id="documentType" bind:value={documentType}>
            {#each DOCUMENT_TYPE_OPTIONS as type}
              <option value={type}>{formatDocumentType(type)}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="file">Document</label>
          <input
            id="file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,text/plain,application/pdf,image/*"
            on:change={handleFileChange}
          />
        </div>

        <button class="primary" disabled={isSubmitting} on:click={submit}>
          <Upload size={18} />
          {isSubmitting ? "Processing" : "Capture and verify"}
        </button>
      </div>
    </section>

    <aside class="panel">
      <div class="panel-header">
        <h2>Sample coverage</h2>
      </div>
      <div class="panel-body">
        <div class="details-grid">
          <div class="detail-item">
            <span>Ohio</span>
            <strong>REAL ID front</strong>
          </div>
          <div class="detail-item">
            <span>Texas</span>
            <strong>Under 21 front</strong>
          </div>
          <div class="detail-item">
            <span>California</span>
            <strong>Expired front</strong>
          </div>
          <div class="detail-item">
            <span>New York</span>
            <strong>Temporary document</strong>
          </div>
          <div class="detail-item">
            <span>Florida</span>
            <strong>Motorcycle endorsement</strong>
          </div>
        </div>
      </div>
    </aside>
  </div>
</section>
