#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const loop=require('../premade-loop-core.js');
const pack=require('../premade-pack.js');

function read(file){return JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));}
function write(file,value){const target=path.resolve(file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,`${JSON.stringify(value,null,2)}\n`);}
function value(args,name,fallback){const index=args.indexOf(name);return index>=0&&args[index+1]!=null?args[index+1]:fallback;}
function has(args,name){return args.includes(name);}
function usage(code=0){
  const text=[
    'AXM Premade Closed Loop v0.17','',
    'Usage:',
    '  node tools/premade-loop.js start GUIDED.json --seed SEED --variants 8 --strength medium --out LOOP.json',
    '  node tools/premade-loop.js keep LOOP.json CANDIDATE_ID [CANDIDATE_ID ...] --out LOOP-kept.json',
    '  node tools/premade-loop.js unkeep LOOP.json CANDIDATE_ID [CANDIDATE_ID ...] --out LOOP-updated.json',
    '  node tools/premade-loop.js commit LOOP.json LIBRARY.json --out LOOP-committed.json --library-out LIBRARY-updated.json --receipt-out MEMORY.json',
    '  node tools/premade-loop.js summary LOOP.json','',
    'Headless start creates structural technical evidence only. Pixel evidence is attached only by a renderer.',
    'Keeper changes require explicit candidate IDs. Memory commit fails when no explicit keeper exists.'
  ].join('\n');
  (code?process.stderr:process.stdout).write(`${text}\n`);process.exit(code);
}

function parseCandidateIds(args){
  const ids=[];
  for(let i=1;i<args.length;i+=1){if(args[i].startsWith('--'))break;ids.push(args[i]);}
  return ids;
}

function main(){
  const [command,...args]=process.argv.slice(2); if(!command||command==='--help'||command==='-h')usage();
  if(command==='start'){
    if(!args[0])usage(1); const guided=read(args[0]);
    const session=loop.createLoopSession(guided,pack,value(args,'--seed',`${guided.id}|loop`),{
      variants:Number(value(args,'--variants',8)),strength:value(args,'--strength','medium'),
      lockBase:!has(args,'--unlock-base'),allowFx:!has(args,'--no-fx'),allowDecals:!has(args,'--no-decals'),
      allowLayerCountChange:!has(args,'--lock-layer-count'),maxExtraLayers:Number(value(args,'--max-extra',8))
    });
    session.execution={mode:'headless-structural',pixelEvidenceAttached:false,note:'No framebuffer was rendered by the Node closed-loop start command.'};
    const out=value(args,'--out',null); if(out)write(out,session); else process.stdout.write(`${JSON.stringify(session,null,2)}\n`); return;
  }
  if(command==='keep'||command==='unkeep'){
    if(!args[0])usage(1); const session=read(args[0]); const ids=parseCandidateIds(args); if(!ids.length)throw new Error(`${command} requires one or more explicit candidate IDs.`);
    ids.forEach((id)=>loop.decideKeeper(session,id,command==='keep','cli-explicit-candidate-id'));
    const out=value(args,'--out',null); if(out)write(out,session); else process.stdout.write(`${JSON.stringify(session,null,2)}\n`); return;
  }
  if(command==='commit'){
    if(!args[0]||!args[1])usage(1); const session=read(args[0]); const library=read(args[1]);
    const receipt=loop.commitKeepersToMemory(session,library,pack,value(args,'--name',`${session.id} explicit keepers`));
    const out=value(args,'--out',null), libraryOut=value(args,'--library-out',null), receiptOut=value(args,'--receipt-out',null);
    if(out)write(out,session); if(libraryOut)write(libraryOut,receipt.updatedLibrary); if(receiptOut)write(receiptOut,receipt);
    if(!out&&!libraryOut&&!receiptOut)process.stdout.write(`${JSON.stringify(receipt,null,2)}\n`); return;
  }
  if(command==='summary'){
    if(!args[0])usage(1); process.stdout.write(`${JSON.stringify(loop.loopSummary(read(args[0])),null,2)}\n`); return;
  }
  usage(1);
}

try{main();}catch(error){process.stderr.write(`${error&&error.stack?error.stack:error}\n`);process.exit(1);}