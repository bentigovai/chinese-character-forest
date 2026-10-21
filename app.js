'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marked=(text,char)=>esc(text).split(esc(char)).join('<mark>'+esc(char)+'</mark>');
const state={char:'山',chars:['山','水'],rows:[],segments:[],pages:[],books:[],curated:[],cards:[],loadId:0,filter:'textbook',atlasPage:0,dict:'all',dictPage:0,lessonPage:0,view:'learn',sound:false,source:null,recognition:null,sentenceMode:false};
let saved={favorites:[],learned:[],quotes:[],sentences:[]};
try{const data=JSON.parse(localStorage.getItem('hanzi-forest-v1')||'{}');for(const key of Object.keys(saved))if(Array.isArray(data[key]))saved[key]=data[key];}catch{}
function status(message){$('#status').textContent=message;}
function persist(){try{localStorage.setItem('hanzi-forest-v1',JSON.stringify(saved));}catch{status('当前浏览器未允许保存，仍可继续学习。');}progress();}
function progress(){$('#learned-count').textContent=saved.learned.length;$('#progress').style.width=Math.min(100,saved.learned.length/20*100)+'%';}
function py(text,options={}){try{return pinyinPro.pinyin(text,options);}catch{return options.type==='array'?[text]:text;}}
function bookTitle(id){return state.books.find(b=>b.id===id)?.title||id;}
function chime(){if(!state.sound)return;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[523,659,784].forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=hz;gain.gain.setValueAtTime(.03,ctx.currentTime+i*.1);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.1+.25);osc.start(ctx.currentTime+i*.1);osc.stop(ctx.currentTime+i*.1+.3);});setTimeout(()=>ctx.close(),900);}catch{}}
function celebrate(){chime();const wrap=document.createElement('div');wrap.className='leaf-celebration';wrap.setAttribute('aria-hidden','true');for(let i=0;i<13;i++){const leaf=document.createElement('span');leaf.textContent=i%3?'✧':'❧';leaf.style.left=(8+Math.random()*84)+'%';leaf.style.animationDelay=(Math.random()*.4)+'s';wrap.append(leaf);}document.body.append(wrap);setTimeout(()=>wrap.remove(),2200);}
function speak(text,mode='explain'){
 if(!('speechSynthesis'in window)){status('设备暂不支持朗读，可以继续看拼音和笔顺。');return;}
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';
 const voices=speechSynthesis.getVoices().filter(v=>/^zh/i.test(v.lang));const voice=voices.find(v=>/Natural|Xiaoxiao|Yunxi|Online/i.test(v.name))||voices.find(v=>/zh[-_]CN/i.test(v.lang))||voices[0];if(voice)u.voice=voice;
 u.rate=mode==='poem'?.72:mode==='story'?.9:.78;u.pitch=mode==='story'?1.12:1;
 u.onstart=()=>{document.body.classList.add('speaking');status('小叶正在读，听完也试着读一遍。');};
 u.onend=()=>{document.body.classList.remove('speaking');status('读完啦！试着用这个词说一句自己的话吧。');};
 u.onerror=e=>{document.body.classList.remove('speaking');if(!['canceled','interrupted'].includes(e.error))status('请检查设备是否安装了中文朗读声音。');};
 speechSynthesis.speak(u);
}
function showView(name){
 state.view=name;['learn','atlas','reading','collection','dictionary'].forEach(v=>$('#'+v+'-view').classList.toggle('hidden',v!==name));
 $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
 $('#view-label').textContent={learn:'汉字探索',atlas:'汉字地图',reading:'课本与美文',collection:'我的收藏',dictionary:'汉字探索 / 字词词典'}[name];
 if(name==='atlas')renderAtlas();if(name==='collection')renderCollection();
}
function toneDescription(char){const all=py(char,{multiple:true,type:'array'});if(all.length>1)return '多音字 '+all.join(' / ');const n=String(py(char,{toneType:'num',type:'array'})[0]).slice(-1);return ({1:'第一声 · 平平地读',2:'第二声 · 向上扬',3:'第三声 · 先降再扬',4:'第四声 · 往下降',0:'轻声 · 轻轻地读'})[n]||'结合句子读一读';}
let lexiconPromise;
function lexicon(){return lexiconPromise||(lexiconPromise=import('./lexicon.mjs?v=hwxnet-1').then(m=>m.createLexicon({showView,getChars:()=>state.chars,getSegments:()=>state.segments,py})).catch(e=>{lexiconPromise=null;throw e;}));}
function openDefinition(term){lexicon().then(l=>l.open(term)).catch(()=>status('词典未能载入，请稍后重试。'));}
function addDictionaryLinks(){
 state.chars.forEach((c,i)=>{const box=document.createElement('div');box.className='character-definition';box.innerHTML='<small class="definition-origin">汉文学网 · 在线字典</small><p data-definition-summary="'+c+'">汉文学网原文词典</p><button data-definition="'+c+'">▤ 查“'+c+'”的词典释义 →</button>';$('[data-card="'+i+'"]').append(box);});
 lexicon().then(l=>l.summarize(state.chars)).catch(()=>{});
}
function renderDeck(){
 $('#character-deck').classList.toggle('dual',state.chars.length===2);
 $('.learning-grid').classList.toggle('two-characters',state.chars.length===2);
 $('#character-deck').innerHTML=state.chars.map((char,i)=>{
 const r=state.rows.find(x=>x.c===char);
 return '<article class="card character-card arriving '+(char===state.char?'selected':'')+'" data-card="'+i+'"><div class="card-top"><span class="pill">'+['','一级','二级','三级'][r.lv]+'规范字 · '+String(r.s).padStart(4,'0')+'</span><button class="icon-button" data-favorite="'+char+'" aria-label="'+(saved.favorites.includes(char)?'取消收藏':'收藏')+char+'">'+(saved.favorites.includes(char)?'★':'☆')+'</button></div><button class="pronunciation" data-speak="'+char+'">'+esc(py(char))+' <small>◖))</small></button><div class="tone">'+esc(toneDescription(char))+'</div><div class="writing-grid"><div id="writer-'+i+'"></div><span class="character-fallback">'+char+'</span><span class="stroke-flash"></span></div><div class="char-meta" id="meta-'+i+'">笔顺正在准备…</div><div class="stroke-track" id="track-'+i+'"></div><div class="write-actions"><button class="primary" data-animate="'+i+'">↻ 再看一遍</button><button data-quiz="'+i+'">✎ 我来写</button></div><div class="stroke-controls"><button data-step="'+i+'">一笔一笔看 →</button><label>速度 <select aria-label="'+char+'字笔顺速度" data-speed="'+i+'"><option value=".6">慢慢写</option><option value="1" selected>正常</option><option value="1.8">快一点</option></select></label></div><p class="small-note feedback" id="feedback-'+i+'">找到汉字后，笔顺会自动播放。</p><button class="context-switch '+(char===state.char?'active':'')+'" data-context="'+char+'">读“'+char+'”的词句 <span>→</span></button></article>';
 }).join('');
}
async function queryChars(input){
 if(!state.rows.length)return;
 const valid=new Set(state.rows.map(r=>r.c));const chars=[...new Set([...String(input)].filter(c=>valid.has(c)))].slice(0,2);
 if(!chars.length){status('没有识别到规范汉字。再点一下，说“山水”试试。');return;}
 state.cards.forEach(c=>c.writer?.cancelQuiz());const id=++state.loadId;state.chars=chars;state.char=chars[0];state.lessonPage=0;state.dictPage=0;
 if('speechSynthesis'in window)speechSynthesis.cancel();document.body.classList.remove('speaking');
 showView('learn');renderDeck();renderContexts();addDictionaryLinks();
 $('#voice-title').textContent='遇见“'+chars.join('')+'” · 看它一笔一画长出来';
 $('#voice-subtitle').textContent=chars.length===2?'两个字的笔顺同时开始。点字卡下方，切换它的课文和好句。':'笔顺自动开始。看完后，用手指或鼠标写一遍。';
 document.body.dataset.scene=chars.some(c=>'水海江河雨'.includes(c))?'water':chars.some(c=>'日月星夜'.includes(c))?'sky':'forest';
 state.cards=chars.map(char=>({char,writer:null,data:null,stroke:0,busy:false,speed:1}));
 const cards=state.cards;
 await Promise.all(cards.map(async(card,i)=>{
 try{
  const data=await HanziData.load('data/'+card.char.codePointAt(0)+'.json');if(id!==state.loadId)return;
  if(!window.HanziWriter)throw Error('component missing');
  card.data=data;makeWriter(card,i);
  $('[data-card="'+i+'"] .character-fallback').style.display='none';
  $('#meta-'+i).textContent=data.strokes.length+' 画 · '+esc(py(card.char));
  $('#track-'+i).innerHTML=data.strokes.map((_,s)=>'<i data-stroke="'+s+'"></i>').join('');
 }catch{if(id===state.loadId){$('#meta-'+i).textContent='该字暂缺笔顺数据';$('#feedback-'+i).textContent='先听读音、读语句，再到原书认识它。';}}
 }));
 if(id!==state.loadId)return;
 status('发现了 '+chars.length+' 位汉字朋友。笔顺自动播放中…');cards.forEach((_,i)=>animateCard(i));chime();
}
function makeWriter(card,i){card.writer=HanziWriter.create('writer-'+i,card.char,{width:216,height:216,padding:22,strokeColor:'#2f5142',radicalColor:'#6f8d59',outlineColor:'#e5e8db',highlightColor:'#be9d4a',strokeAnimationSpeed:card.speed,delayBetweenStrokes:350,charDataLoader:()=>Promise.resolve(card.data)});}
function ready(i){const c=state.cards[i];if(!c?.writer){status('这个字暂时没有笔顺数据，仍可听读音和读原句。');return null;}return c;}
async function animateCard(i){
 const card=ready(i);if(!card)return;const id=state.loadId;card.run=(card.run||0)+1;const run=card.run;card.writer.cancelQuiz();card.busy=true;card.stroke=0;
 const element=$('[data-card="'+i+'"]');element.classList.add('drawing');$('#feedback-'+i).textContent='看，“'+card.char+'”正在一笔一画地出现。';
 try{await card.writer.hideCharacter();$$('#track-'+i+' i').forEach(x=>x.classList.remove('done'));for(let n=0;n<card.data.strokes.length;n++){
  if(id!==state.loadId||card.run!==run)return;
  await card.writer.animateStroke(n);
  if(id!==state.loadId||card.run!==run)return;
  $('#track-'+i+' [data-stroke="'+n+'"]').classList.add('done');
  $('#feedback-'+i).textContent='第 '+(n+1)+' / '+card.data.strokes.length+' 笔';
 }
 if(id===state.loadId&&card.run===run){$('#feedback-'+i).textContent='笔顺看完啦！点“我来写”，点亮一片叶子。';element.classList.remove('drawing');}
 }finally{if(card.run===run)card.busy=false;}
}
function quizCard(i){
 const card=ready(i);if(!card)return;card.run=(card.run||0)+1;card.busy=false;const id=state.loadId;
 $('[data-card="'+i+'"]').classList.remove('drawing');
 card.writer.quiz({onCorrectStroke:d=>{if(id!==state.loadId)return;$('#feedback-'+i).textContent='写对了！还有 '+d.strokesRemaining+' 笔。';},onMistake:()=>{if(id===state.loadId)$('#feedback-'+i).textContent='别急，看看发光的提示，再试一次。';},onComplete:()=>{
  if(id!==state.loadId)return;if(!saved.learned.includes(card.char))saved.learned.push(card.char);persist();celebrate();$('#feedback-'+i).textContent='太棒了！“'+card.char+'”的叶子已经点亮。';$('[data-card="'+i+'"]').classList.add('completed');
 }});
 $('#feedback-'+i).textContent='沿着浅色轮廓，用手指或鼠标写一写。';
}
async function stepCard(i){
 const c=ready(i);if(!c||c.stepBusy)return;c.run=(c.run||0)+1;c.busy=false;c.stepBusy=true;const id=state.loadId;c.writer.cancelQuiz();
 try{if(c.stroke===0){await c.writer.hideCharacter();$$('#track-'+i+' i').forEach(x=>x.classList.remove('done'));}
 await c.writer.animateStroke(c.stroke);if(id!==state.loadId)return;
 $('#feedback-'+i).textContent='第 '+(c.stroke+1)+' / '+c.data.strokes.length+' 笔';
 $('#track-'+i+' [data-stroke="'+c.stroke+'"]').classList.add('done');c.stroke=(c.stroke+1)%c.data.strokes.length;
 }finally{c.stepBusy=false;}
}
function matching(kind){
 const pair=state.chars.join('');
 return state.segments.filter(s=>s.kind===kind&&s.text.includes(state.char)&&(kind==='textbook'||state.dict==='all'||s.book===state.dict)&&s.words.some(w=>w.includes(state.char)))
 .sort((a,b)=>Number(b.verified)-Number(a.verified)||Number(b.text.includes(pair))-Number(a.text.includes(pair))||b.score-a.score);
}
function usefulTip(row){
 if(/像|仿佛|好似|犹如|如同/.test(row.text))return '写作小发现：作者把事物比作了什么？你也换个事物试一试。';
 if(/颜色|红|绿|蓝|紫|金|白|黄/.test(row.text))return '写作小发现：圈出颜色词，让你的画面也有颜色。';
 if(/声音|响|鸣|唱|听|沙沙|叮咚/.test(row.text))return '写作小发现：留意声音，给自己的句子加一点听觉。';
 if(/跑|跳|飞|流|飘|摇|走|落|涌/.test(row.text))return '写作小发现：找出动作词，看看一句话怎样动起来。';
 return '写作小发现：挑一个喜欢的词，说说你见过的画面。';
}
function snippetHTML(row,kind){
 const words=row.words.filter(w=>w.includes(state.char));const used=saved.quotes.some(q=>typeof q==='object'?q.book===row.book&&q.text===row.text:q===row.id);
 return '<article class="snippet '+(row.verified?'verified':'')+'"><div class="source-label">'+esc(bookTitle(row.book))+' · PDF '+row.page+' 页'+(row.title?' · '+esc(row.title):'')+'</div><div class="word-tags">'+words.slice(0,8).map(w=>'<button data-word="'+esc(w)+'"><ruby>'+marked(w,state.char)+'<rt>'+esc(py(w))+'</rt></ruby></button>').join('')+'</div><p class="quote '+(kind==='literature'?'dictionary':'')+'">'+marked(row.text,state.char)+'</p>'+(row.paragraph&&row.paragraph!==row.text?'<details class="paragraph"><summary>展开相邻原文，看看它怎么写</summary><p>'+marked(row.paragraph,state.char)+'</p></details>':'')+(kind==='literature'?'<p class="writing-tip">✧ '+usefulTip(row)+'</p>':'')+'<div class="read-footer"><div><button data-read="'+row.id+'">◖)) 朗读</button> <select class="read-mode" aria-label="朗读语气"><option value="'+(kind==='textbook'?'explain':'story')+'">'+(kind==='textbook'?'温柔讲解':'生动故事')+'</option><option value="poem">舒缓诗歌</option><option value="story">生动故事</option></select><button data-save-quote="'+row.id+'">'+(used?'★ 已摘抄':'☆ 摘进本子')+'</button></div><button class="source-link" data-source="'+row.book+'" data-page="'+row.page+'">原书 ↗</button></div><p class="snippet-note">'+(row.verified?'已对照扫描原页':'由扫描正文自动整理，可能有识别误字 · 可点原书核对')+'</p></article>';
}
function renderContexts(){
 let tabs=$('#context-tabs');if(!tabs){tabs=document.createElement('div');tabs.id='context-tabs';$('.reading-column').prepend(tabs);}
 tabs.innerHTML='<span>正在读谁的故事？</span>'+state.chars.map(c=>'<button class="'+(c===state.char?'active':'')+'" data-context="'+c+'">'+c+' <small>'+esc(py(c))+'</small></button>').join('');
 $('[data-card="0"]')?.classList.toggle('selected',state.chars[0]===state.char);
 $('[data-card="1"]')?.classList.toggle('selected',state.chars[1]===state.char);
 $$('[data-context]').forEach(b=>b.classList.toggle('active',b.dataset.context===state.char));
 const lesson=matching('textbook'),lit=matching('literature');
 const l=lesson.length?lesson[state.lessonPage%lesson.length]:null;
 $('#textbook-content').innerHTML=l?snippetHTML(l,'textbook')+(lesson.length>1?'<button class="other-excerpt" data-other-lesson>再读一处课文 → <small>'+(state.lessonPage%lesson.length+1)+' / '+lesson.length+'</small></button>':''):'<p class="empty-text">暂未整理出含“'+state.char+'”的可靠课文正文。我们继续认识其他字吧。</p>';
 const start=state.dictPage*3,selected=lit.slice(start,start+3);
 $('#literature-content').innerHTML='<div class="result-count">与“'+state.char+'”有关的 '+lit.length+' 条正文摘选</div>'+(selected.length?selected.map(r=>snippetHTML(r,'literature')).join(''):'<p class="empty-text">这本辞典里暂未整理出含目标字的完整词句。试试另一本，或换一个字。</p>')+(lit.length>3?'<div class="pagination"><button data-dict-prev '+(state.dictPage===0?'disabled':'')+'>← 前一页</button><span>'+(state.dictPage+1)+' / '+Math.ceil(lit.length/3)+'</span><button data-dict-next '+(start+3>=lit.length?'disabled':'')+'>再发现三句 →</button></div>':'');
 $('#guide-tip').textContent='用“'+state.char+'”说一句自己的话吧！先观察，再把看到、听到、想到的说出来。';
 $$('.snippet [data-word]').forEach(b=>{const link=document.createElement('button');link.className='word-definition';link.dataset.definition=b.dataset.word;link.textContent='词义 ↗';link.setAttribute('aria-label','查'+b.dataset.word+'的词义');b.after(link);});
}
function setContext(char){
 state.char=char;state.lessonPage=0;state.dictPage=0;renderContexts();
 $('.reading-column').classList.remove('context-changing');void $('.reading-column').offsetWidth;$('.reading-column').classList.add('context-changing');
}
function pool(){if(state.filter==='textbook'){const chars=new Set(state.textbookChars);return state.rows.filter(r=>chars.has(r.c));}return state.filter==='all'?state.rows:state.rows.filter(r=>String(r.lv)===state.filter);}
function charButtons(rows){return rows.map(r=>'<button class="atlas-char" data-char="'+r.c+'">'+r.c+'<small>'+esc(py(r.c))+'</small></button>').join('');}
function renderAtlas(){const rows=pool(),count=Math.max(1,Math.ceil(rows.length/80));state.atlasPage=Math.max(0,Math.min(state.atlasPage,count-1));$('#atlas-grid').innerHTML=charButtons(rows.slice(state.atlasPage*80,state.atlasPage*80+80));$('#atlas-count').textContent=rows.length.toLocaleString()+' 个字';$('#page-label').textContent=(state.atlasPage+1)+' / '+count;$('#prev-page').disabled=!state.atlasPage;$('#next-page').disabled=state.atlasPage>=count-1;}
let memoryAPI=null,memoryLoading=null;
function renderCollection(){
 if(memoryAPI)memoryAPI.render();
 else {
 $('#collection-grid').innerHTML='<p class="empty-text">正在打开记忆森林…</p>';
 if(!memoryLoading)memoryLoading=import('./memory.mjs').then(({createMemory})=>{memoryAPI=createMemory({getRows:()=>state.rows,getFavorites:()=>saved.favorites,getSegments:()=>state.segments,bookTitle,py,status,speak,learn:char=>queryChars(char),chime,isCollection:()=>state.view==='collection',addFavorites:chars=>{saved.favorites=[...new Set([...saved.favorites,...chars])];persist();}});if(state.view==='collection')renderCollection();}).catch(()=>{memoryLoading=null;$('#collection-grid').innerHTML='<p class="empty-text">复习卡暂时未能加载，请重新打开收藏页。</p>';});
 }
 $('#review').disabled=!saved.favorites.length;
 let notes=$('#quote-notebook');if(!notes){notes=document.createElement('div');notes.id='quote-notebook';$('#collection-view').append(notes);}
 notes.innerHTML='<h3>我的好句摘抄本</h3>'+(saved.quotes.length?saved.quotes.map(q=>typeof q==='object'?q:state.segments.find(r=>r.id===q)).filter(Boolean).map(r=>'<article class="saved-quote"><p>'+esc(r.text)+'</p><small>'+esc(bookTitle(r.book))+' · PDF '+r.page+' 页</small><button data-speak="'+esc(r.text)+'">听一听 ◖))</button></article>').join(''):'<p class="empty-text">在好句旁点“摘进本子”，下次就能再读。</p>')+'<h3>我自己说的句子</h3>'+saved.sentences.map(s=>'<p class="my-sentence">“'+esc(s.text)+'” <small>练习字：'+esc(s.char)+'</small></p>').join('');
}
function next(){const rows=pool();if(!rows.length)return;const i=rows.findIndex(r=>r.c===state.char);queryChars(rows[(i+1)%rows.length].c);}
function parseSpoken(text){
 let clean=String(text).replace(/[，。！？、\s]/g,'');
 const explained=[...clean.matchAll(/([^的，。！？、\s]{1,8})的([\u3400-\u9fff])(?:字)?/g)].filter(m=>m[1].includes(m[2])).map(m=>m[2]);
 if(explained.length)return explained.slice(0,2).join('');
 if([...clean].length<=2)return clean.length===2&&clean.endsWith('字')?clean.slice(0,-1):clean;
 clean=clean.replace(/^(请|帮我|我想|我要|给我|我想要|一起|现在|来|查询|查找|查一下|查|搜索|学习|认识|显示|播放|演示|看看|汉字)+/g,'');
 clean=clean.replace(/的笔顺|笔顺|的笔画|笔画|这两个字|这一个字|两个字|一个字|怎么写|怎么读|汉字|一个|两个|和|还有|以及|字/g,'');
 return [...clean].slice(0,2).join('');
}
function handleSpoken(text){
 if(state.sentenceMode){
  state.sentenceMode=false;const cleaned=text.trim();
  if(!cleaned.includes(state.char)){status('我听到“'+cleaned+'”。再试着把“'+state.char+'”用进去吧。');return;}
  saved.sentences.push({char:state.char,text:cleaned});persist();celebrate();$('#guide-tip').textContent='你说：“'+cleaned+'” · 已放进你的句子本。';status('你用到了“'+state.char+'”！再想一想，能加一个颜色、声音或动作词吗？');return;
 }
 const clean=text.replace(/[，。！？\s]/g,'');status('听见了：“'+text+'”');
 if(/^(停止|停下|停止朗读)$/.test(clean)){if('speechSynthesis'in window)speechSynthesis.cancel();return;}
 if(/^(下一个|下一字|下一个字)$/.test(clean))return next();
 if(/^(我来写|描红|练习)$/.test(clean))return quizCard(Math.max(0,state.chars.indexOf(state.char)));
 if(/^(朗读|读一读|读课文)$/.test(clean)){const r=matching('textbook')[state.lessonPage%Math.max(1,matching('textbook').length)];if(r)speak(r.text);return;}
 if(/^(笔顺|播放笔顺|再看一遍)$/.test(clean)){state.cards.forEach((_,i)=>animateCard(i));return;}
 queryChars(parseSpoken(text));
}
function nativeVoice(sentenceMode=false){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){status('当前浏览器没有提供在线语音识别，请选择本地中文识别，或用 Chrome / Edge 打开。');return;}
 if(state.recognition){state.recognition.stop();return;}
 if('speechSynthesis'in window)speechSynthesis.cancel();state.sentenceMode=sentenceMode;
 const rec=new Recognition();rec.lang='zh-CN';rec.interimResults=true;rec.continuous=true;
 let active=true,finalText='',interim='',timer=null;
 const cleanup=()=>{clearTimeout(timer);document.body.classList.remove('listening');$('#mic').setAttribute('aria-label','点击说出一个或两个汉字');state.recognition=null;};
 const finish=()=>{if(!active)return;active=false;cleanup();rec.stop();const text=(finalText+interim).trim();if(text)handleSpoken(text);else{ $('#voice-title').textContent='点一下，把汉字说给小叶听';status('已停止听取，未录入评分或学习记录。');}};
 const controller={stop:finish};state.recognition=controller;
 rec.onstart=()=>{if(!active)return;document.body.classList.add('listening');$('#mic').setAttribute('aria-label','停止语音识别');$('#voice-title').textContent='小叶在听，请开始说';$('#voice-subtitle').textContent='浏览器在线识别。没开口前不会主动结束；说完请稍停。';status('浏览器语音服务已启动，正在等你开口。');};
 rec.onresult=e=>{if(!active)return;interim='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)finalText+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript;}const text=finalText+interim;if(text.trim()){ $('#voice-subtitle').textContent='听到了：'+text;clearTimeout(timer);timer=setTimeout(finish,2400);}};
 rec.onerror=e=>{if(e.error==='no-speech')return;if(!active)return;active=false;cleanup();$('#voice-title').textContent='浏览器语音服务暂不可用';status(({'not-allowed':'麦克风未获授权，请在浏览器设置中允许麦克风。','audio-capture':'没有找到可用麦克风。','network':'浏览器在线语音服务连接失败，请切换本地中文识别。','service-not-allowed':'浏览器没有提供可用的在线语音服务，请切换本地中文识别。'})[e.error]||'浏览器识别错误：'+e.error);};
 rec.onend=()=>{if(!active)return;setTimeout(()=>{if(active&&state.recognition===controller)try{rec.start();}catch{active=false;cleanup();status('浏览器未能继续识别，请切换本地中文识别。');}},250);};
 try{rec.start();}catch{active=false;cleanup();status('无法启动浏览器语音识别，请选择本地中文识别。');}
}
function sourcePage(book,page){const b=state.books.find(x=>x.id===book);if(!b)return;page=Math.max(1,Math.min(b.totalPages,page));state.source={book,page};$('#page-title').textContent=b.title+' · PDF 第 '+page+' 页';$('#page-image').src='pages/'+book+'/'+page+'.webp';if(!$('#page-dialog').open)$('#page-dialog').showModal();}
function sources(){
 $('#source-details').innerHTML='<p>主目录以 2013 年《通用规范汉字表》8105 字为基础。3500 个一级字全部具有笔顺数据，当前共有 6866 字有笔顺；1239 个二、三级字暂缺笔顺。素材中的 2009 年征求意见稿作为历史资料保留。</p><p>已索引素材内六册上册教材和两本辞典，共 '+state.pages.length+' 页。当前没有下册教材，不能视为小学全套教材。</p><p>阅读区先过滤目录、编者、版权、出版信息与练习指令，再提取正文完整句和含字词语。优先展示已对照原页的精选摘录；自动整理的扫描内容仍可能有误字，请通过“原书”核对。写作提示为本站学习引导，不属于引文。</p><ul>'+state.books.map(b=>'<li>'+esc(b.title)+'：'+b.indexedPages+'/'+b.totalPages+' 页。</li>').join('')+'</ul><p>拼音来自 pinyin-pro，多音字结合词句读音；笔顺来自 Hanzi Writer / Make Me a Hanzi，属于辅助数据。朗读使用设备中文语音，语速和音高随场景切换，不等同于专业情感配音。</p><p>点击麦克风才开始识别，默认在设备本地处理；手动切换浏览器在线识别时，可能使用浏览器厂商服务。收藏、摘抄、描红和造句记录保存在此浏览器。书籍扫描识别内容用于语境学习，可能存在误字，学习时请核对原书。</p><p><a href="https://www.moe.gov.cn/jyb_xwfb/s271/202009/t20200915_488073.html" target="_blank" rel="noopener">教育部字表说明</a> · <a href="https://github.com/frankslin/cn-characters-standard" target="_blank" rel="noopener">字表电子整理来源</a> · <a href="https://hanziwriter.org" target="_blank" rel="noopener">笔顺组件</a></p>';
 $('#source-dialog').showModal();
}
function librarySearch(query){const q=query.trim();if(!q)return;const rows=state.segments.filter(s=>s.text.includes(q)).slice(0,40);$('#reading-results').innerHTML='<p class="muted">'+(rows.length?'正文摘选前 '+rows.length+' 条':'没有找到完整正文语句，换一个词试试。')+'</p>'+rows.map(r=>'<article class="search-result"><span class="source-label">'+esc(bookTitle(r.book))+' · PDF '+r.page+' 页</span><p>'+marked(r.text,q)+'</p><button data-source="'+r.book+'" data-page="'+r.page+'">原书 ↗</button> <button data-read="'+r.id+'">听一听 ◖))</button></article>').join('');}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view)showView(b.dataset.view);
 if(b.dataset.definition)openDefinition(b.dataset.definition);
 if(b.dataset.char)queryChars(b.dataset.char);
 if(b.dataset.pair)queryChars(b.dataset.pair);
 if(b.dataset.context)setContext(b.dataset.context);
 if(b.dataset.favorite){const c=b.dataset.favorite,i=saved.favorites.indexOf(c);if(i<0){saved.favorites.push(c);celebrate();}else saved.favorites.splice(i,1);persist();b.textContent=i<0?'★':'☆';b.setAttribute('aria-label',(i<0?'取消收藏':'收藏')+c);status(i<0?'已收藏“'+c+'”。':'已取消收藏。');}
 if(b.hasAttribute('data-animate'))animateCard(Number(b.dataset.animate));
 if(b.hasAttribute('data-quiz'))quizCard(Number(b.dataset.quiz));
 if(b.hasAttribute('data-step'))stepCard(Number(b.dataset.step));
 if(b.dataset.speak)speak(b.dataset.speak);
 if(b.dataset.word)speak(b.dataset.word);
 if(b.hasAttribute('data-read')){const row=state.segments.find(r=>r.id===Number(b.dataset.read));if(row)speak(row.paragraph||row.text,b.parentElement.querySelector('.read-mode')?.value||'story');}
 if(b.hasAttribute('data-save-quote')){const id=Number(b.dataset.saveQuote),row=state.segments.find(r=>r.id===id);if(!row)return;const i=saved.quotes.findIndex(q=>typeof q==='object'?q.book===row.book&&q.text===row.text:q===id);if(i<0){saved.quotes.push({text:row.text,book:row.book,page:row.page});celebrate();b.textContent='★ 已摘抄';}else{saved.quotes.splice(i,1);b.textContent='☆ 摘进本子';}persist();}
 if(b.dataset.source)sourcePage(b.dataset.source,Number(b.dataset.page));
 if(b.hasAttribute('data-other-lesson')){state.lessonPage++;renderContexts();}
 if(b.dataset.dict){state.dict=b.dataset.dict;state.dictPage=0;$$('[data-dict]').forEach(x=>x.classList.toggle('active',x===b));renderContexts();}
 if(b.hasAttribute('data-dict-prev')){state.dictPage--;renderContexts();}
 if(b.hasAttribute('data-dict-next')){state.dictPage++;renderContexts();}
 if(b.dataset.filter){state.filter=b.dataset.filter;state.atlasPage=0;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderAtlas();}
 if(b.classList.contains('dialog-close'))b.closest('dialog').close();
});
document.addEventListener('change',e=>{if(e.target.hasAttribute('data-speed')){const i=Number(e.target.dataset.speed),c=state.cards[i];if(c?.writer){c.run=(c.run||0)+1;c.writer.cancelQuiz();c.speed=Number(e.target.value);$('#writer-'+i).replaceChildren();makeWriter(c,i);animateCard(i);}}});
$('#mic').onclick=()=>voice();$('#hero-voice').onclick=()=>voice();$('#guide-read').onclick=()=>speak($('#guide-tip').textContent,'story');
$('#next').onclick=next;$('#random').onclick=()=>{const rows=pool().length?pool():state.rows;if(rows.length)queryChars(rows[Math.floor(Math.random()*rows.length)].c);};
$('#sound-button').onclick=()=>{state.sound=!state.sound;$('#sound-button').textContent=state.sound?'♫ 音效开':'♫ 音效关';$('#sound-button').setAttribute('aria-pressed',state.sound);chime();};
$('#sources-button').onclick=sources;$('#footer-sources').onclick=sources;
$('#prev-page').onclick=()=>{state.atlasPage--;renderAtlas();};$('#next-page').onclick=()=>{state.atlasPage++;renderAtlas();};
$('#review').onclick=()=>memoryAPI?.start();
$('#source-prev').onclick=()=>sourcePage(state.source.book,state.source.page-1);$('#source-next').onclick=()=>sourcePage(state.source.book,state.source.page+1);
$('#reading-form').onsubmit=e=>{e.preventDefault();librarySearch($('#reading-query').value);};
const stop=document.createElement('button');stop.textContent='停止朗读';stop.className='stop-reading';stop.onclick=()=>{if('speechSynthesis'in window)speechSynthesis.cancel();document.body.classList.remove('speaking');status('朗读已停止。');};$('.header-right').prepend(stop);
const sentence=document.createElement('button');sentence.textContent='♩ 我来造个句';sentence.className='sentence-button';sentence.onclick=()=>voice(true);$('#guide-read').after(sentence);
async function init(){
 progress();status('小叶正在打开你的汉字森林…');
 try{const [rows,library]=await Promise.all(['data/standard.json','data/library.json'].map(p=>HanziData.load(p)));state.rows=rows;Object.assign(state,library);
 $('#book-list').innerHTML=state.books.map(b=>'<button class="book-tile" data-source="'+b.id+'" data-page="1"><img src="pages/'+b.id+'/1.webp" alt="'+esc(b.title)+'封面" loading="lazy"><b>'+esc(b.title)+'</b><span>'+b.indexedPages+' 页 · '+(b.id.startsWith('book')?'教材':'辞典')+'</span></button>').join('');
 await queryChars('山水');
 }catch(err){console.error(err);status('书库没有完整载入，请刷新后重试。');}
}
init();


let offlineModelPromise=null,offlineSession=null;
function loadOfflineModel(){
 if(offlineModelPromise)return offlineModelPromise;
 offlineModelPromise=(async()=>{
  if(!window.Vosk)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='vendor/vosk.js?v=3-ready';s.onload=resolve;s.onerror=reject;document.head.append(s);});
  const manifest=await fetch('models/manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('model manifest');return r.json();});
  const cache=await caches.open('hanzi-local-speech-v1').catch(()=>null);
  const buffers=await Promise.all(manifest.chunks.map(async n=>{const path='models/'+n;let r=cache?await cache.match(path):null;if(!r){r=await fetch(path);if(!r.ok)throw Error('model chunk');if(cache)await cache.put(path,r.clone()).catch(()=>{});}return r.arrayBuffer();}));
  const url=URL.createObjectURL(new Blob(buffers,{type:'application/gzip'}));
  try{
   const model=new Vosk.Model(url,0);
   model.on('diagnostic',m=>{model.lastDiagnostic=m.message;});
   return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{model.terminate();reject(Error('语音模型准备超时'));},60000);model.on('load',m=>{clearTimeout(timeout);m.result?resolve(model):reject(Error('模型加载失败'));});model.on('error',m=>{console.warn('Local model detail',JSON.stringify(m));clearTimeout(timeout);reject(Error(JSON.stringify(m)));});});
  }finally{URL.revokeObjectURL(url);}
 })().catch(e=>{offlineModelPromise=null;throw e;});
 return offlineModelPromise;
}
function createReadyRecognizer(model,sampleRate){
 return new Promise((resolve,reject)=>{
  const rec=new model.KaldiRecognizer(sampleRate);
  const timeout=setTimeout(()=>{rec.remove();reject(Error('识别器未能就绪，请运行语音检查'));},15000);
  rec.on('ready',()=>{clearTimeout(timeout);resolve(rec);});
  rec.on('error',m=>{clearTimeout(timeout);rec.remove();reject(Error(model.lastDiagnostic||m.error||'识别器创建失败'));});
 });
}
async function voice(sentenceMode=false){
 if(offlineSession){
  if(offlineSession.phase==='error'){offlineSession.retry?.();return;}
  if(offlineSession.ctx?.state==='suspended'){await offlineSession.ctx.resume();status('麦克风已继续，等你说话。');return;}
  offlineSession.stop();return;
 }
 if(state.recognition){state.recognition.stop();return;}
 if($('#speech-engine')?.value==='browser'){nativeVoice(sentenceMode);return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.WebAssembly){nativeVoice(sentenceMode);return;}
 if('speechSynthesis'in window)speechSynthesis.cancel();state.sentenceMode=sentenceMode;
 const gate=new HanziSpeechGate();
 const session={stopped:false,phase:'preparing',gate,stream:null,ctx:null,rec:null,timer:null,frames:0,errorCount:0};offlineSession=session;
 const station=$('.voice-station');
 station.dataset.voicePhase='preparing';station.dataset.hasSpeech='false';station.dataset.audioFrames='0';
 document.body.classList.add('listening');$('#mic').setAttribute('aria-label','取消语音准备');
 $('#voice-title').textContent='正在打开麦克风…';
 $('#voice-subtitle').textContent='准备好后，小叶会一直等你开口。';
 status('正在连接麦克风，不用着急说话。');
 const finish=(text,reason)=>{
  if(session.stopped)return;session.stopped=true;session.phase='stopped';
  clearInterval(session.timer);
  if(session.processor){session.processor.onaudioprocess=null;session.processor.disconnect();}
  session.source?.disconnect();session.gain?.disconnect();
  session.stream?.getTracks().forEach(t=>t.stop());
  session.rec?.remove();session.ctx?.close();
  if(offlineSession===session)offlineSession=null;
  station.dataset.voicePhase='idle';station.style.setProperty('--mic-level','0');
  document.body.classList.remove('listening');$('#mic').setAttribute('aria-label','点击说出一个或两个汉字');
  if(text){handleSpoken(text.replace(/\s+/g,''));}
  else{
   $('#voice-title').textContent='点一下，把汉字说给小叶听';
   $('#voice-subtitle').textContent='说一个或两个字，说完稍停，就会自动查找。';
   if(reason==='device')status('麦克风连接已断开。请检查设备后再试。');
   else status('已停止听取。再点一下就能继续。');
  }
 };
 session.stop=()=>finish(gate.heardSpeech?gate.result():'','cancel');
 try{
  session.ctx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:16000});
  await session.ctx.resume();
  const audio={channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true};
  if(state.microphoneId)audio.deviceId={exact:state.microphoneId};
  session.stream=await navigator.mediaDevices.getUserMedia({audio,video:false});
  if(session.stopped){session.stream.getTracks().forEach(t=>t.stop());return;}
  session.stream.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(!session.stopped)finish('','device');}));
  const track=session.stream.getAudioTracks()[0];
  $('#voice-title').textContent=offlineModelPromise?'正在准备听你说…':'第一次使用，正在准备中文语音…';
  $('#voice-subtitle').textContent='麦克风已连接。准备完成后会提示“请开始说”。';
  status('首次准备需要加载中文模型，准备完成前不会开始计时。');
  const model=await loadOfflineModel();if(session.stopped)return;
  const attachRecognizer=async()=>{
   session.rec?.remove();
   const rec=await createReadyRecognizer(model,session.ctx.sampleRate);if(session.stopped){rec.remove();return;}session.rec=rec;rec.setWords(true);
   rec.on('partialresult',m=>{
    if(session.stopped||rec!==session.rec)return;
    const text=m.result.partial||'';
    if(gate.hypothesis(text,Date.now()))$('#voice-subtitle').textContent='听到：'+gate.text+' · 说完停一会儿';
   });
   rec.on('result',m=>{
    if(session.stopped||rec!==session.rec)return;
    const words=m.result.result||[];
    const confidence=words.length?words.reduce((n,w)=>n+w.conf,0)/words.length:null;
    if(gate.hypothesis(m.result.text,Date.now(),true,confidence))$('#voice-subtitle').textContent='听到：'+gate.text+' · 等你说完';
   });
   rec.on('error',m=>{
    if(session.stopped||rec!==session.rec)return;
    console.warn('Speech recognizer error',JSON.stringify(m));session.errorCount++;
    session.phase='error';station.dataset.voicePhase='error';$('#mic').setAttribute('aria-label','重新连接语音识别');$('#voice-title').textContent='识别暂停，请点按钮重新连接';status('识别错误：'+(model.lastDiagnostic||m.error||'未知错误')+'。可展开“语音检查与识别方式”定位原因。');
   });
  };
  session.retry=async()=>{try{if(session.stopped)return;await session.ctx.resume();session.errorCount=0;await attachRecognizer();session.phase='listening';station.dataset.voicePhase='listening';$('#mic').setAttribute('aria-label','停止语音识别');$('#voice-title').textContent='小叶在听，请开始说';status('已重新连接，会一直等你开口。');}catch(e){status('重新连接失败：'+e.message);}};
  await attachRecognizer();if(session.stopped)return;
  session.source=session.ctx.createMediaStreamSource(session.stream);
  session.processor=session.ctx.createScriptProcessor(4096,1,1);session.gain=session.ctx.createGain();session.gain.gain.value=0;
  session.processor.onaudioprocess=e=>{
   if(session.stopped)return;
   session.frames++;station.dataset.audioFrames=String(session.frames);
   const now=Date.now(),sample=e.inputBuffer;
   const activity=gate.feed(sample.getChannelData(0),sample.sampleRate,now);
   station.style.setProperty('--mic-level',String(activity.level));station.dataset.hasSpeech=String(gate.heardSpeech);
   if(activity.heardSpeech&&session.phase==='listening'){
    session.phase='hearing';station.dataset.voicePhase='hearing';
    $('#voice-title').textContent=sentenceMode?'听到了，继续说你的句子…':'听到了，你可以继续说';
    status('听到声音了。说完停两秒左右，会自动查找。');
   }
   if(session.phase!=='error')session.rec.acceptWaveform(sample);
  };
  session.source.connect(session.processor);session.processor.connect(session.gain);session.gain.connect(session.ctx.destination);
  session.phase='listening';session.started=Date.now();station.dataset.voicePhase='listening';
  $('#mic').setAttribute('aria-label','停止语音识别');
  $('#voice-title').textContent=sentenceMode?'小叶在听，请开始说你的句子':'小叶在听，请开始说';
  $('#voice-subtitle').textContent=sentenceMode?'用“'+state.char+'”说一句话。没开口前不会自动结束。':'说“山水”，或“大山的山，河水的水”。没开口前不会自动结束。';
  status('本地识别已就绪 · 正在等待你开口 · 再点按钮可手动结束。');
  let devices=$('#microphone-options');
  if(!devices){
   devices=document.createElement('details');devices.id='microphone-options';devices.className='microphone-options';
   devices.innerHTML='<summary>麦克风设置</summary><label>使用的麦克风 <select id="microphone-device" aria-label="选择麦克风"></select></label>';
   station.after(devices);
  }
  const inputs=(await navigator.mediaDevices.enumerateDevices().catch(()=>[])).filter(d=>d.kind==='audioinput');
  $('#microphone-device').innerHTML=inputs.map(d=>'<option value="'+esc(d.deviceId)+'" '+(d.deviceId===track?.getSettings().deviceId?'selected':'')+'>'+esc(d.label||'麦克风')+'</option>').join('');
  $('#microphone-device').onchange=async e=>{state.microphoneId=e.target.value;finish('','cancel');await voice(sentenceMode);};
  session.timer=setInterval(()=>{
   if(session.stopped||session.phase==='error')return;
   const now=Date.now();
   if(gate.shouldFinish(now)){finish(gate.result(),'result');return;}
   if(!gate.heardSpeech&&now-session.started>10000){
    $('#voice-subtitle').textContent='我还在等你，不会自动结束。可以靠近麦克风，或打开“麦克风设置”换一个。';
   }else if(gate.heardSpeech&&!gate.text&&gate.lastVoiceAt!==null&&now-gate.lastVoiceAt>4500){
    $('#voice-subtitle').textContent='听到了声音，还没认清汉字。你可以直接再说一遍。';
   }
  },150);
 }catch(err){
  if(session.stopped)return;
  console.warn('Local speech unavailable',err);finish('','cancel');
  if(err?.name==='NotAllowedError'||err?.name==='PermissionDeniedError'){status('麦克风未获授权，请在浏览器中允许麦克风后再试。');return;}
  if(err?.name==='NotFoundError'||err?.name==='OverconstrainedError'){state.microphoneId='';status('选中的麦克风不可用。请检查设备，再点按钮使用默认麦克风。');return;}
  $('#voice-title').textContent='中文语音暂时未准备好，点一下重试';
  status('本地语音没有启动成功：'+(err?.message||'设备连接异常')+'。点击按钮重试。');
 }
}


const speechTools=document.createElement('details');speechTools.className='speech-diagnostics';speechTools.innerHTML='<summary>语音检查与识别方式</summary><p>默认在设备上识别中文，语音不上传。初次使用要下载约44 MB模型。公开网址请用 HTTPS，并允许浏览器使用麦克风。</p><label>识别方式 <select id="speech-engine"><option value="local">本地中文识别</option><option value="browser">浏览器在线识别（依赖浏览器服务）</option></select></label> <button id="speech-self-test">检查中文识别引擎</button><p id="speech-check-result" aria-live="polite">检查会识别一段“山水”示例音频，不会开启麦克风。若检查成功却听不到你，优先检查麦克风选择和权限。</p>';
$('.voice-station').after(speechTools);
$('#speech-engine').onchange=()=>{offlineSession?.stop();state.recognition?.stop();};
$('#speech-self-test').onclick=async()=>{
 const button=$('#speech-self-test'),out=$('#speech-check-result');if(offlineSession||state.recognition){out.textContent='请先点麦克风结束当前识别，再运行检查。';return;}
 button.disabled=true;out.textContent='正在检查模型、识别器和中文音频…';let rec,ctx;
 try{
  ctx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:16000});await ctx.resume();const model=await loadOfflineModel();rec=await createReadyRecognizer(model,16000);
  const audio=await ctx.decodeAudioData(await fetch('asr-test.wav').then(r=>{if(!r.ok)throw Error('示例音频未载入');return r.arrayBuffer();}));
  const result=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('示例识别超时')),20000);rec.on('result',m=>{const text=m.result.text?.replace(/\s+/g,'');if(text){clearTimeout(timeout);resolve(text);}});rec.on('error',m=>{clearTimeout(timeout);reject(Error(model.lastDiagnostic||m.error));});});
  const samples=audio.getChannelData(0);for(let i=0;i<samples.length;i+=4096)rec.acceptWaveformFloat(samples.slice(i,i+4096),audio.sampleRate);for(let i=0;i<12;i++)rec.acceptWaveformFloat(new Float32Array(4096),audio.sampleRate);rec.retrieveFinalResult();
  const text=await result;out.textContent=text==='山水'?'检查通过：中文模型、识别器和示例音频均正常，已识别“山水”。如果说话仍无结果，请在麦克风设置里选择实际使用的设备。':'引擎可以运行，示例识别为“'+text+'”。短音节和同音字可能混淆，建议说“大山的山，河水的水”。';
 }catch(e){out.textContent='检查未通过：'+e.message+'。可以重试，或改用浏览器在线识别。';}
 finally{rec?.remove();ctx?.close();button.disabled=false;}
};
