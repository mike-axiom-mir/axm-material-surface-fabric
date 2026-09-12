(function () {
  'use strict';

  const core=window.AXMPremadeComposerCore;
  const pack=window.AXMPremadePack;
  const bridge=window.AXMPremadeComposerBridge;
  if (!core || !pack || !bridge) return;

  function loadRecipe(next,metadata) {
    const validation=core.validateRecipe(next,pack);
    if (!validation.ok) throw new Error(validation.reason);
    const input=document.querySelector('#premadeImportRecipe');
    if (!input) throw new Error('Premade composer import input is unavailable.');
    if (typeof DataTransfer!=='function' || typeof File!=='function') throw new Error('This browser does not expose the local File/DataTransfer bridge required for in-page recipe handoff.');
    const file=new File([JSON.stringify(next,null,2)],`${next.id||'premade-recipe'}.json`,{type:'application/json'});
    const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    window.dispatchEvent(new CustomEvent('axm-premade-recipe-loaded',{detail:{recipeId:next.id||null,source:metadata&&metadata.source||'in-page-bridge'}}));
    return core.clone(next);
  }

  bridge.loadRecipe=loadRecipe;
  window.addEventListener('axm-premade-load-recipe',(event)=>{
    const detail=event.detail||{};
    try { loadRecipe(detail.recipe,detail); }
    catch (error) { window.dispatchEvent(new CustomEvent('axm-premade-recipe-load-failed',{detail:{message:error.message,source:detail.source||null}})); }
  });
})();
