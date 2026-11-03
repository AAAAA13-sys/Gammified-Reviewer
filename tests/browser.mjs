// Run after an Expo web export. Set CHROME_PATH when Chrome is installed elsewhere.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

const notes = 'The aorta carries blood away from the heart. The vena cava carries blood back to the heart.';
const questions = [
  {type:'choice',prompt:'Which vessel carries blood away from the heart?',answer:'Aorta',options:['Aorta','Vena cava','Trachea','Ureter'],quote:'The aorta carries blood away from the heart.',explanation:'Ang aorta ang dinadaanan ng dugo palabas ng puso.'},
  {type:'typed',prompt:'Where does the vena cava bring blood?',answer:'Back to the heart',quote:'The vena cava carries blood back to the heart.',explanation:'Ang vena cava ang nagbabalik ng dugo sa puso.'},
  {type:'choice',prompt:'Which vessel returns blood to the heart?',answer:'Vena cava',options:['Aorta','Vena cava','Trachea','Ureter'],quote:'The vena cava carries blood back to the heart.',explanation:'Ang vena cava ang tamang ugat.'},
];
const local = async server => {
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  return 'http://127.0.0.1:'+server.address().port;
};
const provider = http.createServer(async(req,res)=>{
  let raw=''; for await(const chunk of req) raw+=chunk;
  const input=JSON.parse(JSON.parse(raw).messages[1].content);
  const content=JSON.stringify(input.notes ? {questions} : {correct:input.student==='Pabalik sa puso.'});
  res.end(JSON.stringify({choices:[{message:{content}}]}));
});
const www = http.createServer(async(req,res)=>{
  const root=path.resolve('dist');
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)) return res.writeHead(403).end();
  try {
    const content=await readFile(file);
    const type=path.extname(file)==='.html'?'text/html':path.extname(file)==='.js'?'text/javascript':'application/octet-stream';
    res.writeHead(200,{'Content-Type':type}).end(content);
  } catch {res.writeHead(404).end();}
});
let browser,child;
try {
  const ai=await local(provider), site=await local(www);
  child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',AI_API_KEY:'browser-fixture',AI_CHAT_URL:ai}});
  const [ready]=await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('API startup failed');})]);
  const backend='http://127.0.0.1:'+String(ready).trim().split(' ').at(-1);
  browser=await chromium.launch({channel:process.env.CHROME_PATH ? undefined : 'chrome',executablePath:process.env.CHROME_PATH,headless:true});
  async function play(width,voice,pauseMs) {
    const page=await browser.newPage({viewport:{width,height:820}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('http://127.0.0.1:8787/**',async route=>{
      const response=await route.fetch({url:backend+new URL(route.request().url()).pathname});
      await route.fulfill({response});
    });
    const click=name=>page.getByRole('button',{name,exact:true}).click();
    await page.goto(site);
    async function pickNotes() {
      const pickerEvent=page.waitForEvent('filechooser');
      await click('+ Choose file');
      await (await pickerEvent).setFiles({name:'circulation.txt',mimeType:'text/plain',buffer:Buffer.from(notes)});
    }
    await pickNotes();
    await click(voice);
    await click('Start recall run →');
    await click('B Vena cava'); await click('Lock in answer →');
    await page.getByText('MISS / −1 LIFE',{exact:true}).waitFor();
    await page.getByText('“'+questions[0].quote+'”').waitFor();
    await click('Next question →');
    await page.getByRole('textbox').fill('Pabalik sa puso.'); await click('Lock in answer →');
    await page.getByText('CORRECT / +10 COINS',{exact:true}).waitFor();
    if(pauseMs) {console.log('Holding a real browser study session for',pauseMs,'ms');await delay(pauseMs);}
    await page.reload(); await click('Resume last run →');
    await page.getByText('Your answer · Pabalik sa puso.').waitFor();
    await click('Next question →');
    await click('B Vena cava'); await click('Lock in answer →');
    await click('+1 life / 20 coins');
    await page.getByText('♥ 3 lives',{exact:true}).waitFor();
    await click('Next question →'); await page.getByText(/RECALL RETRY/).waitFor();
    await click('A Aorta'); await click('Lock in answer →'); await click('View results →');
    await page.getByText('3 correct · 4 answered · 4 questions').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    assert.deepEqual(errors,[]);
    await click('Start another run');
    assert.equal(await page.getByRole('button',{name:'Resume last run →'}).count(),0);
    await pickNotes();
    await click('Start recall run →');
    await page.route('**/answer',route=>route.fulfill({status:404,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({error:'Session expired. Start another run.'})}));
    await click('A Aorta'); await click('Lock in answer →');
    await page.getByText('Session expired. Start another run.').waitFor();
    await page.getByRole('button',{name:'Start recall run →'}).waitFor({timeout:4000});
    await page.close(); console.log('Passed',width+'px',voice,'browser run');
  }
  await Promise.all([play(390,'Bisaya',Number(process.env.STUDY_PAUSE_MS || 0)),play(1280,'Tagalog',0)]);
} finally {
  await browser?.close(); child?.kill(); provider.close(); www.close();
}
