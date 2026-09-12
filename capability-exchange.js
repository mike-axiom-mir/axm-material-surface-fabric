(function () {
  'use strict';

  const core = window.AXMMaterialCapabilityExchangeCore;
  const premadePack = window.AXMPremadePack;
  if (!core || !premadePack) throw new Error('Capability Exchange requires v0.18 core and premade pack.');
  const workspaceGrid = document.querySelector('.workspace-grid');
  if (!workspaceGrid) return;

  let artifacts = [];
  let capabilityPack = null;
  let ledger = core.createUsageLedger('local material capability use');

  const panel = document.createElement('section');
  panel.className = 'panel capability-exchange-panel';
  panel.innerHTML = `
    <div class="panel-heading">
      <div><div class="panel-kicker">19</div><h2>Capability Exchange / Downstream Use</h2></div>
      <span class="count-pill">v0.18</span>
    </div>
    <div class="truth-note">Export exact material/sprite/recipe/pattern capability state and import explicit downstream use receipts. Usage evidence stays descriptive: adoption/reuse is not beauty, physical truth, or automatic promotion authority.</div>

    <div class="capx-toolbar">
      <label class="button primary" for="capxArtifacts">Import source artifacts</label>
      <input id="capxArtifacts" type="file" accept="application/json,.json" multiple hidden />
      <button class="button accent" id="capxBuild" disabled>Build capability pack</button>
      <label class="button" for="capxPackInput">Import capability pack</label>
      <input id="capxPackInput" type="file" accept="application/json,.json" hidden />
      <label class="button" for="capxFeedbackInput">Import downstream feedback</label>
      <input id="capxFeedbackInput" type="file" accept="application/json,.json" hidden />
      <button class="button" id="capxExportPack" disabled>Export pack</button>
      <button class="button" id="capxExportLedger">Export use ledger</button>
      <span id="capxStatus">no capability pack</span>
    </div>

    <div class="capx-layout">
      <section class="capx-subpanel">
        <div class="influence-subheading"><strong>Source artifacts</strong><span id="capxArtifactCount">0</span></div>
        <div id="capxArtifactList" class="capx-list"></div>
        <hr />
        <div class="influence-subheading"><strong>Capability pack</strong><span id="capxCapabilityCount">0</span></div>
        <div id="capxCapabilityList" class="capx-list capx-scroll"></div>
      </section>

      <section class="capx-subpanel">
        <div class="influence-subheading"><strong>Downstream evidence</strong><span id="capxFeedbackCount">0 receipts</span></div>
        <div id="capxSummary" class="capx-summary"></div>
        <div id="capxUsageRows" class="capx-list capx-scroll"></div>
      </section>

      <section class="capx-subpanel">
        <div class="influence-subheading"><strong>Machine contract</strong><span>portable JSON</span></div>
        <pre id="capxOutput" class="state-output capx-output"></pre>
      </section>
    </div>
  `;
  workspaceGrid.appendChild(panel);

  const el = {
    artifacts:panel.querySelector('#capxArtifacts'),build:panel.querySelector('#capxBuild'),packInput:panel.querySelector('#capxPackInput'),
    feedbackInput:panel.querySelector('#capxFeedbackInput'),exportPack:panel.querySelector('#capxExportPack'),exportLedger:panel.querySelector('#capxExportLedger'),
    status:panel.querySelector('#capxStatus'),artifactCount:panel.querySelector('#capxArtifactCount'),artifactList:panel.querySelector('#capxArtifactList'),
    capabilityCount:panel.querySelector('#capxCapabilityCount'),capabilityList:panel.querySelector('#capxCapabilityList'),feedbackCount:panel.querySelector('#capxFeedbackCount'),
    summary:panel.querySelector('#capxSummary'),usageRows:panel.querySelector('#capxUsageRows'),output:panel.querySelector('#capxOutput')
  };

  function escapeHtml(value) { return String(value==null?'':value).replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function download(name,value) {
    const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function artifactLabel(artifact,index) { return `${artifact.format || 'unknown-format'} / ${artifact.version || 'unversioned'} · ${artifact.id || `artifact-${index+1}`}`; }

  function renderArtifacts() {
    el.artifactCount.textContent=String(artifacts.length);
    el.artifactList.innerHTML=artifacts.length ? artifacts.map((artifact,index)=>`<div class="capx-row"><span><strong>${escapeHtml(artifact.format||'unknown')}</strong><small>${escapeHtml(artifact.id||`artifact-${index+1}`)}</small></span><small>${escapeHtml(artifact.version||'')}</small></div>`).join('') : '<div class="capx-empty">Import material libraries, sprite indices, recipes, keeper packs, pattern libraries, guided receipts, loop sessions, or memory receipts.</div>';
    el.build.disabled=!artifacts.length;
  }

  function renderPack() {
    const caps=capabilityPack&&capabilityPack.capabilities||[];
    el.capabilityCount.textContent=String(caps.length);
    el.exportPack.disabled=!capabilityPack;
    el.capabilityList.innerHTML=caps.length ? caps.map((cap)=>`<div class="capx-row"><span><strong>${escapeHtml(cap.kind)}</strong><small>${escapeHtml(cap.sourceId)}</small></span><small>${escapeHtml(cap.id.slice(-10))}</small></div>`).join('') : '<div class="capx-empty">No pack loaded.</div>';
    if (capabilityPack) {
      el.output.textContent=JSON.stringify({
        format:capabilityPack.format,version:capabilityPack.version,id:capabilityPack.id,fingerprint:capabilityPack.fingerprint,
        producer:capabilityPack.producer,summary:capabilityPack.summary,
        receiverContract:{
          feedbackFormat:core.FEEDBACK_FORMAT,feedbackVersion:core.VERSION,
          actions:core.ACTIONS,outcomes:core.OUTCOMES,
          rule:'Feedback events must reference exact capability IDs from this pack. Importing feedback does not auto-promote producer state.'
        }
      },null,2);
    } else el.output.textContent='';
  }

  function renderLedger() {
    const summary=core.usageSummary(ledger);
    el.feedbackCount.textContent=`${summary.feedbackReceipts} receipt${summary.feedbackReceipts===1?'':'s'}`;
    el.summary.innerHTML=`<div><span>Capabilities observed</span><strong>${summary.capabilitiesObserved}</strong></div><div><span>Events</span><strong>${summary.totalEvents}</strong></div><div><span>Adopted</span><strong>${summary.adoptedEvents}</strong></div><div><span>Reused</span><strong>${summary.reusedEvents}</strong></div><div><span>Rejected</span><strong>${summary.rejectedEvents}</strong></div><div><span>HOLD</span><strong>${summary.heldEvents}</strong></div>`;
    el.usageRows.innerHTML=summary.rows.length ? summary.rows.map((row)=>`<div class="capx-row"><span><strong>${escapeHtml(row.kind)} · ${escapeHtml(row.sourceId)}</strong><small>${row.events} events · ${row.consumers.length} consumer(s)</small></span><small>A ${row.adopted} · R ${row.reused} · X ${row.rejected} · H ${row.held}</small></div>`).join('') : '<div class="capx-empty">No downstream use evidence imported. Absence of feedback means unknown use, not non-use.</div>';
  }

  el.artifacts.addEventListener('change',async()=>{
    const files=Array.from(el.artifacts.files||[]); if (!files.length) return;
    try {
      const parsed=[]; for (const file of files) parsed.push(JSON.parse(await file.text()));
      artifacts=artifacts.concat(parsed); renderArtifacts(); el.status.textContent=`${parsed.length} source artifact(s) added`;
    } catch (error) { el.status.textContent=`artifact import failed: ${error.message}`; }
    el.artifacts.value='';
  });

  el.build.addEventListener('click',()=>{
    try {
      capabilityPack=core.createCapabilityPack(artifacts,premadePack,{name:'AXM Material Capability Pack'});
      const validation=core.validateCapabilityPack(capabilityPack); if (!validation.ok) throw new Error(validation.reason);
      renderPack(); el.status.textContent=`built ${capabilityPack.summary.total} capability entries`;
    } catch (error) { el.status.textContent=`pack build failed: ${error.message}`; }
  });

  el.packInput.addEventListener('change',async()=>{
    const file=el.packInput.files&&el.packInput.files[0]; if (!file) return;
    try {
      const parsed=JSON.parse(await file.text()); const validation=core.validateCapabilityPack(parsed); if (!validation.ok) throw new Error(validation.reason);
      capabilityPack=parsed; renderPack(); el.status.textContent=`loaded capability pack ${parsed.id}`;
    } catch (error) { el.status.textContent=`pack import failed: ${error.message}`; }
    el.packInput.value='';
  });

  el.feedbackInput.addEventListener('change',async()=>{
    const file=el.feedbackInput.files&&el.feedbackInput.files[0]; if (!file) return;
    try {
      if (!capabilityPack) throw new Error('load the exact capability pack before feedback');
      const feedback=JSON.parse(await file.text()); const validation=core.validateUseFeedback(feedback,capabilityPack); if (!validation.ok) throw new Error(validation.reason);
      const result=core.applyUseFeedback(ledger,feedback,capabilityPack); ledger=result.ledger; renderLedger();
      el.status.textContent=result.duplicate?'feedback already present; no counts changed':`applied ${feedback.events.length} downstream event(s)`;
    } catch (error) { el.status.textContent=`feedback import failed: ${error.message}`; }
    el.feedbackInput.value='';
  });

  el.exportPack.addEventListener('click',()=>capabilityPack&&download(`${capabilityPack.id}.json`,capabilityPack));
  el.exportLedger.addEventListener('click',()=>download(`${ledger.id}.json`,ledger));

  renderArtifacts(); renderPack(); renderLedger();
})();
