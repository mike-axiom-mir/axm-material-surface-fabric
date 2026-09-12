(function(){
  'use strict';
  const patternKey='axm-premade-pattern-library-v0.15.0';
  function parsedGuideOutput(){
    const node=document.querySelector('#guideOutput');
    if(!node||!node.textContent.trim()) return null;
    try {
      const parsed=JSON.parse(node.textContent);
      return parsed&&parsed.format==='axm-premade-guided-composition-receipt' ? parsed : null;
    } catch (_) { return null; }
  }
  function savedLibrary(){
    try {
      const raw=localStorage.getItem(patternKey); if(!raw) return null;
      const parsed=JSON.parse(raw);
      return parsed&&parsed.format==='axm-premade-pattern-library' ? parsed : null;
    } catch (_) { return null; }
  }
  window.AXMPremadeGuideBridge={
    getReceipt:()=>{ const value=parsedGuideOutput(); return value==null?null:JSON.parse(JSON.stringify(value)); },
    getLibrary:()=>{ const value=savedLibrary(); return value==null?null:JSON.parse(JSON.stringify(value)); }
  };
})();