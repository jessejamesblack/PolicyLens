<script lang="ts">
  import { page } from "$app/stores";
  import { AlertCircle, CheckCircle2, RefreshCw } from "@lucide/svelte";
  import type { DocumentRecord, StructuredLicenseExtraction } from "@policylens/domain";
  import { getDocument, processDocument } from "$lib/api";
  import { percent } from "$lib/chartData";

  let documentRecord: DocumentRecord | null = null;
  let isLoading = true;
  let isProcessing = false;
  let errorMessage = "";

  $: extraction = documentRecord?.extraction as StructuredLicenseExtraction | null | undefined;

  async function loadDocument() {
    isLoading = true;
    errorMessage = "";

    try {
      documentRecord = await getDocument($page.params.id);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Document could not be loaded.";
    } finally {
      isLoading = false;
    }
  }

  async function reprocess() {
    isProcessing = true;
    errorMessage = "";

    try {
      await processDocument($page.params.id);
      await loadDocument();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Processing failed.";
    } finally {
      isProcessing = false;
    }
  }

  function formatBoolean(value: boolean | null | undefined): string {
    if (value === true) {
      return "Yes";
    }

    if (value === false) {
      return "No";
    }

    return "Missing";
  }

  function formatList(values: string[]): string {
    return values.length ? values.join(", ") : "None";
  }

  $: if ($page.params.id) {
    loadDocument();
  }
</script>

<section class="page">
  <div class="page-header">
    <div>
      <h1>{documentRecord?.filename ?? "Extraction detail"}</h1>
      {#if documentRecord}
        <p>{documentRecord.documentType} document created {new Date(documentRecord.createdAt).toLocaleString()}</p>
      {/if}
    </div>
    {#if documentRecord}
      <button class="secondary" disabled={isProcessing} on:click={reprocess}>
        <RefreshCw size={17} />
        {isProcessing ? "Processing" : "Reprocess"}
      </button>
    {/if}
  </div>

  {#if errorMessage}
    <div class="error"><AlertCircle size={17} /> {errorMessage}</div>
  {:else if isLoading}
    <div class="panel"><div class="panel-body muted">Loading document...</div></div>
  {:else if documentRecord}
    <div class="grid two">
      <section class="panel">
        <div class="panel-header">
          <h2>Normalized fields</h2>
          <span class={`status ${(documentRecord.validationStatus ?? documentRecord.status).toLowerCase()}`}>
            {documentRecord.validationStatus ?? documentRecord.status}
          </span>
        </div>
        <div class="panel-body">
          {#if extraction}
            <div class="details-grid">
              <div class="detail-item"><span>Full name</span><strong>{extraction.fullName ?? "Missing"}</strong></div>
              <div class="detail-item"><span>License number</span><strong>{extraction.licenseNumber ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Issuing state</span><strong>{extraction.issuingState ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Date of birth</span><strong>{extraction.dateOfBirth ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Issue date</span><strong>{extraction.issueDate ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Expiration date</span><strong>{extraction.expirationDate ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Address</span><strong>{extraction.address ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Class</span><strong>{extraction.licenseClass ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Endorsements</span><strong>{formatList(extraction.endorsements)}</strong></div>
              <div class="detail-item"><span>Restrictions</span><strong>{formatList(extraction.restrictions)}</strong></div>
              <div class="detail-item"><span>Sex</span><strong>{extraction.sex ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Height</span><strong>{extraction.height ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Weight</span><strong>{extraction.weight ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Eye color</span><strong>{extraction.eyeColor ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Hair color</span><strong>{extraction.hairColor ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Organ donor</span><strong>{formatBoolean(extraction.organDonor)}</strong></div>
              <div class="detail-item"><span>Veteran</span><strong>{formatBoolean(extraction.veteran)}</strong></div>
              <div class="detail-item"><span>REAL ID</span><strong>{formatBoolean(extraction.realId)}</strong></div>
              <div class="detail-item"><span>Under 21 until</span><strong>{extraction.under21Until ?? "N/A"}</strong></div>
              <div class="detail-item"><span>Age at scan</span><strong>{extraction.ageAtScan ?? "Missing"}</strong></div>
              <div class="detail-item"><span>Expired</span><strong>{formatBoolean(extraction.isExpired)}</strong></div>
              <div class="detail-item"><span>Confidence</span><strong>{percent(extraction.confidenceScore)}</strong></div>
            </div>
          {:else}
            <p class="muted">No extraction has been stored for this document.</p>
          {/if}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Validation warnings</h2>
          {#if extraction?.warnings.length === 0}
            <CheckCircle2 size={19} class="muted" />
          {/if}
        </div>
        <div class="panel-body">
          {#if extraction?.warnings.length}
            <ul class="warning-list">
              {#each extraction.warnings as warning}
                <li>
                  <strong>{warning.category}</strong>
                  <span class="muted">{warning.field}: {warning.message}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="muted">No validation warnings.</p>
          {/if}
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top: 1rem;">
      <div class="panel-header">
        <h2>Raw extracted JSON</h2>
      </div>
      <div class="panel-body">
        <pre>{JSON.stringify({ rawOcr: documentRecord.rawOcr, rawExtraction: documentRecord.rawExtraction }, null, 2)}</pre>
      </div>
    </section>
  {/if}
</section>
