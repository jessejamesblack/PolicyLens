<script lang="ts">
  import { onMount } from "svelte";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import type { DashboardSummary } from "@driverslicense/domain";
  import ChartCanvas from "$lib/ChartCanvas.svelte";
  import { getDashboardSummary } from "$lib/api";
  import {
    confidenceByDocumentTypeChart,
    documentsByIssuingStateChart,
    documentsByStatusChart,
    expirationBucketChart,
    percent
  } from "$lib/chartData";

  let summary: DashboardSummary | null = null;
  let isLoading = true;
  let errorMessage = "";

  async function loadSummary() {
    isLoading = true;
    errorMessage = "";

    try {
      summary = await getDashboardSummary();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Dashboard could not be loaded.";
    } finally {
      isLoading = false;
    }
  }

  onMount(loadSummary);
</script>

<section class="page">
  <div class="page-header">
    <div>
      <h1>Data quality dashboard</h1>
      <p>Operational metrics from processed license scans, normalized fields, and validation metadata.</p>
    </div>
    <button class="secondary" on:click={loadSummary} disabled={isLoading}>
      <RefreshCw size={17} />
      Refresh
    </button>
  </div>

  {#if errorMessage}
    <div class="error"><AlertCircle size={17} /> {errorMessage}</div>
  {:else if isLoading}
    <div class="panel"><div class="panel-body muted">Loading dashboard...</div></div>
  {:else if summary}
    <div class="metric-grid" style="margin-bottom: 1rem;">
      <div class="metric"><span>Documents processed</span><strong>{summary.documentsProcessed}</strong></div>
      <div class="metric"><span>Average confidence</span><strong>{percent(summary.averageConfidence)}</strong></div>
      <div class="metric"><span>Validation warnings</span><strong>{summary.warningCount}</strong></div>
      <div class="metric"><span>REAL ID</span><strong>{summary.realIdCount}</strong></div>
      <div class="metric"><span>Organ donor</span><strong>{summary.organDonorCount}</strong></div>
      <div class="metric"><span>Veteran</span><strong>{summary.veteranCount}</strong></div>
      <div class="metric"><span>Expired</span><strong>{summary.expiredCount}</strong></div>
      <div class="metric"><span>Under 21</span><strong>{summary.under21Count}</strong></div>
      <div class="metric"><span>Average age</span><strong>{summary.averageAge}</strong></div>
    </div>

    <div class="chart-grid">
      <section class="chart-card">
        <h2>Documents by issuing state</h2>
        <ChartCanvas type="bar" data={documentsByIssuingStateChart(summary)} />
      </section>
      <section class="chart-card">
        <h2>Documents by validation status</h2>
        <ChartCanvas type="doughnut" data={documentsByStatusChart(summary)} />
      </section>
      <section class="chart-card">
        <h2>Expiration buckets</h2>
        <ChartCanvas type="bar" data={expirationBucketChart(summary)} />
      </section>
      <section class="chart-card">
        <h2>Average confidence by document type</h2>
        <ChartCanvas
          type="bar"
          data={confidenceByDocumentTypeChart(summary)}
          options={{
            scales: {
              y: {
                min: 0,
                max: 1
              }
            }
          }}
        />
      </section>
      <section class="chart-card">
        <h2>Warning categories</h2>
        {#if summary.warningCountByCategory.length}
          <ul class="warning-list">
            {#each summary.warningCountByCategory as warning}
              <li>
                <strong>{warning.category}</strong>
                <span class="muted">{warning.count} documents or fields</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted">No warning categories recorded.</p>
        {/if}
      </section>
    </div>
  {/if}
</section>
