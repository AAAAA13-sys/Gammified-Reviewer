// Explicit, billable smoke check against a running quiz server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8787';
async function post(path, body) {
  const response = await fetch(server + path, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Quiz server request failed.');
  return result;
}

const { configured } = await post('/status',{});
assert.ok(configured,'Configure AI_API_KEY on the server and restart it before running this check.');
const file = await readFile(new URL('./fixtures/water-cycle.pdf',import.meta.url));
const run = await post('/quiz',{name:'water-cycle.pdf',data:file.toString('base64'),voice:'Tagalog'});
assert.ok(run.question,'Expected a question generated from the uploaded PDF.');
const question = run.question;
const answer = question.type === 'choice' ? question.options[0] : 'Hindi ko alam.';
const graded = await post('/answer',{token:run.token,id:question.id,answer});
assert.equal(graded.index,1);
assert.ok(graded.feedback.quote && graded.feedback.explanation && graded.feedback.answer);
assert.equal(graded.feedback.location,'Page 1');
assert.equal(graded.coins,graded.feedback.correct ? 10 : 0);
assert.equal(graded.lives,graded.feedback.correct ? 3 : 2);
console.log('Live PDF quiz and first answer verified.', JSON.stringify(graded.feedback,null,2));
