(function(root){
 'use strict';
 async function decode(response){
  if(!response.ok)throw Error('学习数据载入失败：'+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());let text;
  if(bytes[0]===31&&bytes[1]===139){
   if(typeof DecompressionStream!=='function')throw Error('请更新 Chrome、Edge 或 Safari 以读取学习数据');
   text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }else text=new TextDecoder().decode(bytes);
  return JSON.parse(text);
 }
 async function load(path){
  const packed=path.replace(/\.json$/,'.json.gz');let response=await fetch(packed);
  if(response.status===404)response=await fetch(path);
  return decode(response);
 }
 root.HanziData={load,decode};
})(globalThis);
