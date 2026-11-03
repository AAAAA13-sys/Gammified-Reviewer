import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

const notes = 'Evaporation changes liquid water into vapor. Condensation changes vapor into liquid water.';
const choice = {
  type:'choice',prompt:'What changes liquid water into vapor?',options:['Evaporation','Condensation','Freezing','Melting'],
  answer:'Evaporation',quote:'Evaporation changes liquid water into vapor.',explanation:'The starting phase is liquid and the ending phase is gas.'
};
const typed = {
  type:'typed',prompt:'What happens during condensation?',answer:'Vapor becomes liquid water.',
  quote:'Condensation changes vapor into liquid water.',explanation:'The vapor returns to its liquid phase.'
};
test('API supports upload, both question formats, evidence, rewards and extra lives',async t=>{
  const provider = http.createServer(async(req,res)=>{
    let raw=''; for await (const chunk of req) raw+=chunk;
    const data=JSON.parse(JSON.parse(raw).messages[1].content);
    const result=data.notes ? {questions:[choice,typed,{...choice,prompt:'Choose the process for liquid to gas.'}]} : {correct:data.student==='Ang singaw ay nagiging tubig.'};
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));
  });
  provider.listen(0,'127.0.0.1'); await once(provider,'listening');
  t.after(()=>provider.close());
  const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',AI_API_KEY:'test',AI_CHAT_URL:'http://127.0.0.1:'+provider.address().port}});
  t.after(()=>child.kill());
  const [ready]=await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited before listening');})]);
  const base='http://127.0.0.1:'+String(ready).trim().split(' ').at(-1);
  const unwanted=await fetch(base+'/quiz',{method:'POST',headers:{Origin:'https://unrelated.example'},body:'{}'});
  assert.equal(unwanted.status,403);
  const post=async(path,body)=>{
    const response=await fetch(base+path,{method:'POST',body:JSON.stringify(body)});
    return {status:response.status,...await response.json()};
  };
  const game=await post('/quiz',{name:'water.txt',voice:'Bisaya',data:Buffer.from(notes).toString('base64')});
  assert.equal(game.status,200); assert.equal(game.lives,3); assert.equal(game.question.answer,undefined);
  assert.equal((await post('/life',{token:game.token})).status,400);
  const reply=(id,answer)=>post('/answer',{token:game.token,id,answer});
  const first=await reply(game.question.id,'Evaporation');
  assert.equal(first.coins,10); assert.equal(first.question.type,'typed');
  const retry=await reply(game.question.id,'Evaporation');
  assert.deepEqual(retry,first);
  assert.equal((await reply(game.question.id,'Melting')).status,409);
  const second=await reply(first.question.id,'Ang singaw ay nagiging tubig.');
  assert.equal(second.coins,20); assert.equal(second.feedback.correct,true);
  const purchase={token:game.token,lives:second.lives,coins:second.coins};
  const bought=await post('/life',purchase);
  assert.equal(bought.coins,0); assert.equal(bought.lives,4);
  const resumed=await post('/resume',{token:game.token});
  assert.equal(resumed.name,'water.txt'); assert.equal(resumed.voice,'Bisaya');
  assert.equal(resumed.question.id,second.question.id); assert.equal(resumed.lives,4);
  assert.deepEqual(await post('/life',purchase),bought);
  const miss=await reply(second.question.id,'Melting');
  assert.equal(miss.lives,3); assert.equal(miss.feedback.answer,'Evaporation');
  assert.equal(miss.feedback.quote,choice.quote); assert.equal(miss.feedback.correct,false);
  assert.equal(miss.question.review,true);
  assert.notEqual(miss.question.id,second.question.id);
  const reviewed=await reply(miss.question.id,'Melting');
  assert.equal(reviewed.question,null);
  assert.equal(reviewed.index,4);
  assert.equal((await post('/quiz',{name:'bad.exe',data:'YQ=='})).status,400);
  for (const ext of ['docx','pdf']) {
    const bytes=await readFile(new URL('./fixtures/water-cycle.'+ext,import.meta.url));
    const fromFile=await post('/quiz',{name:'water.'+ext,data:bytes.toString('base64')});
    assert.equal(fromFile.status,200,ext+' extraction: '+fromFile.error);
    const graded=await post('/answer',{token:fromFile.token,id:fromFile.question.id,answer:'Melting'});
    if(ext==='pdf') assert.equal(graded.feedback.location,'Page 1');
  }
  const utf16=await post('/quiz',{name:'water.txt',data:Buffer.from('\uFEFF'+notes,'utf16le').toString('base64')});
  assert.equal(utf16.status,200);
});
