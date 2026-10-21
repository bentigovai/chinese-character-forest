const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dictionaryURL(term){
 const value=String(term).trim();if(!value||[...value].length>30||!/^[\p{Script=Han}]+$/u.test(value))throw Error('请选择一个汉字或汉语词语');
 if([...value].length===1)return 'https://zd.hwxnet.com/search/'+encodeURIComponent(value).replaceAll('%','hwx')+'.html';
 if(typeof globalThis.md5!=='function')throw Error('词条链接组件尚未载入，请刷新重试');
 const slug=globalThis.md5(value).slice(8,24).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 return 'https://cd.hwxnet.com/view/'+slug+'.html';
}
export function searchURL(term){return [...term].length===1?'https://zd.hwxnet.com/search.do?keyword='+encodeURIComponent(term):'https://cd.hwxnet.com/search.do?wd='+encodeURIComponent(term);}
export function createLexicon(host){
 function open(term){
  host.showView('dictionary');const root=document.querySelector('#dictionary-content');
  const active=host.getChars(),tabs=[...new Set([...active,active.join(''),term])];
  try{
   const url=dictionaryURL(term),isWord=[...term].length>1;
   const words=[...new Set(host.getSegments().filter(s=>s.verified&&s.words.some(w=>w.includes(term))).flatMap(s=>s.words.filter(w=>w.includes(term)&&w!==term)))].slice(0,12);
   root.innerHTML='<nav class="lexicon-tabs" aria-label="本次查询的字词">'+tabs.map(t=>'<button class="'+(t===term?'active':'')+'" data-definition="'+esc(t)+'">'+esc(t)+'</button>').join('')+'</nav><div class="lexicon-title"><div><span class="eyebrow">WORDS OPEN NEW WORLDS</span><h2>'+esc(term)+' <small>'+esc(host.py(term))+'</small></h2></div><button data-speak="'+esc(term)+'">◖)) 听读音</button></div><div class="hwxnet-source"><div><b>汉文学网 · '+(isWord?'汉语词典':'在线新华字典')+'</b><p>原文随当前字词自动切换，释义、用法和例句均以汉文学网原页为准。</p></div><a class="primary" href="'+url+'" target="_blank" rel="noopener noreferrer">打开词典原页 ↗</a></div><div class="hwxnet-frame-wrap"><iframe class="hwxnet-frame" src="'+url+'" title="汉文学网：'+esc(term)+'的'+(isWord?'词语释义':'汉字释义')+'" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe></div><p class="hwxnet-note">词典原页需要联网。若未显示或没有收录该词，可<a href="'+searchURL(term)+'" target="_blank" rel="noopener noreferrer">在汉文学网搜索“'+esc(term)+'”</a>，也可切换上方单字。页面文字及解释由汉文学网提供。</p>'+(words.length?'<div class="lexicon-related"><h3>课文和美文里的相关词语</h3>'+words.map(w=>'<button data-definition="'+esc(w)+'">'+esc(w)+' ↗</button>').join('')+'</div>':'');
   document.querySelector('#dictionary-view').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }catch(e){root.innerHTML='<p class="memory-warning">'+esc(e.message)+'</p><button data-definition="'+esc(term)+'">重试</button>';}
 }
 function summarize(chars){for(const c of chars){const p=document.querySelector('[data-definition-summary="'+c+'"]');if(p)p.textContent='自动打开汉文学网原条目，查看拼音、部首、字义与常用词组。';}}
 return {open,summarize};
}
