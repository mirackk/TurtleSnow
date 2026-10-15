import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feedback} from '../src/feedback.js';
const url='https://turtlesnow.snowcast.workers.dev/api/feedback';
const request=(body,origin=new URL(url).origin)=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
const valid={category:'suggestion',message:'Please add more resorts',email:'',language:'en',resort:'brighton'};
test('valid feedback is stored with a hash instead of a raw IP',async()=>{
 let values;const env={FEEDBACK_DB:{prepare:()=>({bind:(...args)=>{values=args;return {run:async()=>({meta:{changes:1}})}}})}};
 assert.equal((await feedback(request(valid),env)).status,201);assert.equal(values[1],valid.message);assert.match(values[5],/^[a-f0-9]{64}$/);assert.ok(!values.includes('192.0.2.1'));
});
test('invalid submissions and cross-origin requests never touch database',async()=>{
 for(const body of [{...valid,message:'x'},{...valid,email:'bad'},{...valid,category:'unknown'}])assert.equal((await feedback(request(body),{})).status,400);
 assert.equal((await feedback(request(valid,'https://other.example'),{})).status,403);
 assert.equal((await feedback(request({...valid,message:'a'.repeat(13000)}),{})).status,413);
 assert.equal((await feedback(request({...valid,website:'spam'}),{})).status,200);
});
test('rate limits and storage failures have explicit error responses',async()=>{
 const env={FEEDBACK_DB:{prepare:()=>({bind:()=>({run:async()=>({meta:{changes:0}})})})}};
 assert.equal((await feedback(request(valid),env)).status,429);
 assert.equal((await feedback(request(valid),{})).status,503);
});
