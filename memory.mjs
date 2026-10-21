import {SCHEMA,RATINGS,newRecord,preview,reviewRecord,dueCharacters,dayKey,validRecord,mergeBackup,retrievability} from './memory-core.mjs';
const KEY='hanzi-forest-memory-v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=x=>JSON.parse(JSON.stringify(x));
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const dateText=d=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d));
function intervalText(d,now=new Date()){
 const sec=Math.max(0,(new Date(d)-now)/1000);
 if(sec<45)return '不到1分钟';if(sec<3600)return Math.round(sec/60)+'分钟';
 if(sec<86400)return Math.round(sec/3600)+'小时';
 return Math.max(1,Math.round(sec/86400))+'天';
}
const initial=()=>({schema:SCHEMA,app:'hanzi-forest-memory',settings:{retention:.9,sessionSize:10},cards:{},logs:[],events:[]});
export function createMemory(host){
 let db=null,filter='all',session=null,undoId=null,historyChar=null,historyLimit=30;
 const validChars=()=>new Set(host.getRows().map(r=>r.c));
 const favorites=()=>host.getFavorites().filter(c=>validChars().has(c));
 function load(){
  const raw=localStorage.getItem(KEY);if(!raw)return initial();
  const parsed=JSON.parse(raw);
  if(parsed.schema!==SCHEMA||!parsed.cards||!Array.isArray(parsed.logs)||!Array.isArray(parsed.events))throw Error('复习记录格式异常，请先导出备份');
  parsed.settings={...initial().settings,...parsed.settings};
  if(![.85,.9,.95].includes(parsed.settings.retention))parsed.settings.retention=.9;
  if(![5,10,20].includes(parsed.settings.sessionSize))parsed.settings.sessionSize=10;
  if(Object.values(parsed.cards).some(r=>!validRecord(r)))throw Error('部分复习记录格式异常，请先导出备份');
  return parsed;
 }
 function save(next){localStorage.setItem(KEY,JSON.stringify(next));db=next;}
 function ensure(){
  db=load();let changed=false;
  for(const char of favorites())if(!db.cards[char]){db.cards[char]=newRecord();db.events.push({id:uid(),char,type:'add',label:'加入记忆森林',at:new Date().toISOString()});changed=true;}
  if(changed)save(db);
  return db;
 }
 function record(char){ensure();return db.cards[char];}
 function logFor(char){return db.logs.filter(l=>l.char===char&&!l.undone).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));}
 function status(text){host.status(text);}
 function familiarity(r){return r.suspended?'已暂停':r.card.reps===0?'新朋友':r.mark==='unfamiliar'?'不熟悉':r.mark==='familiar'?'渐渐熟练':'继续巩固';}
 function render(){
  const collection=$('#collection-view');let root=$('#memory-root');
  if(!root){root=document.createElement('div');root.id='memory-root';collection.insertBefore(root,$('#collection-grid'));}
  collection.querySelector('h2').textContent='我的记忆森林';
  collection.querySelector('.muted').textContent='先试着想起来，再翻卡核对。忘记很正常，下一次再见面。';
  $('#review').classList.add('hidden');
  try{ensure();}catch(e){root.innerHTML='<p class="memory-warning">'+esc(e.message)+'。原有记录没有被覆盖。</p><button data-memory-export>导出记录备份</button>';return;}
  const chars=favorites(),now=new Date(),due=dueCharacters(chars,db.cards,now),today=db.logs.filter(l=>!l.undone&&dayKey(l.at)===dayKey(now));
  const unfamiliar=chars.filter(c=>db.cards[c].mark==='unfamiliar'),paused=chars.filter(c=>db.cards[c].suspended);
  root.innerHTML='<div class="memory-stats"><div><b>'+due.length+'</b><span>现在该复习</span></div><div><b>'+today.length+'</b><span>今天已回顾</span></div><div><b>'+unfamiliar.length+'</b><span>还不太熟悉</span></div><div><b>'+chars.length+'</b><span>收藏的字</span></div></div>'+
  '<div class="memory-start"><div><span class="eyebrow">LITTLE BY LITTLE, LEAF BY LEAF</span><h3>'+(due.length?'有 '+due.length+' 个字，等着和你再见面':'今天可以轻松一点')+'</h3><p>'+(due.length?'先回忆，再看答案。每次只走一小段。':'到期的字都复习过啦。也可以自由练习，不改变排期。')+'</p></div><div class="memory-start-actions"><button class="primary" data-memory-start="due" '+(!due.length?'disabled':'')+'>▷ 开始到期复习</button><button data-memory-start="practice" '+(!chars.length?'disabled':'')+'>自由练习</button></div></div>'+
  '<div class="memory-controls"><div class="memory-filters">'+[['all','全部'],['due','到期'],['unfamiliar','不熟悉'],['flagged','重点'],['suspended','暂停']].map(([k,t])=>'<button class="'+(filter===k?'active':'')+'" data-memory-filter="'+k+'">'+t+(k==='suspended'?' '+paused.length:'')+'</button>').join('')+'</div><label>每轮 <select id="memory-session-size" aria-label="每轮闪卡数量">'+[5,10,20].map(n=>'<option value="'+n+'" '+(db.settings.sessionSize===n?'selected':'')+'>'+n+' 张</option>').join('')+'</select></label></div>'+
  '<div class="memory-plan"><h4>接下来的七天 <small>已排期的字 · 不含暂停卡片</small></h4><div class="memory-week">'+weekHTML(chars,now)+'</div></div>'+
  '<details class="memory-science"><summary>复习为什么这样安排？</summary><p>借鉴 Anki 的主动回忆与间隔复习，使用 FSRS 调度器。默认目标保留率 90%，是排期目标，不是成绩保证。每次评分会更新这个字的记忆状态，最初使用通用模型参数，没有为孩子训练个人模型。</p><p>忘记请选择“重来”；“困难”表示已经想起来，只是比较费力。间隔会随表现变化，不采用人人相同的固定“1、2、4、7天”表。</p><label>排期目标 <select id="memory-retention" aria-label="复习排期目标">'+[.85,.9,.95].map(n=>'<option value="'+n+'" '+(db.settings.retention===n?'selected':'')+'>'+Math.round(n*100)+'%</option>').join('')+'</select></label><small>更高的目标通常带来更多复习。修改只影响之后的评分，不立即改动已有到期时间。</small><p><a href="https://docs.ankiweb.net/deck-options.html#fsrs" target="_blank" rel="noopener">Anki 官方说明 ↗</a> · <a href="https://open-spaced-repetition.github.io/ts-fsrs/" target="_blank" rel="noopener">FSRS 开源实现 ↗</a></p></details>'+
  '<div class="memory-data-tools"><button data-memory-export>↓ 导出学习记录</button><label class="memory-import">↑ 导入备份<input id="memory-import-file" type="file" accept="application/json,.json" hidden></label><span>记录保存在当前浏览器，可导出备份。</span></div>';
  let shown=chars.filter(c=>filter==='all'||filter==='due'&&!db.cards[c].suspended&&new Date(db.cards[c].card.due)<=now||filter==='unfamiliar'&&db.cards[c].mark==='unfamiliar'||filter==='flagged'&&db.cards[c].flagged||filter==='suspended'&&db.cards[c].suspended);
  shown.sort((a,b)=>Number(db.cards[b].flagged)-Number(db.cards[a].flagged)||new Date(db.cards[a].card.due)-new Date(db.cards[b].card.due));
  const grid=$('#collection-grid');grid.className='memory-card-list';
  grid.innerHTML=shown.length?shown.map(c=>{
   const r=db.cards[c],isDue=!r.suspended&&new Date(r.card.due)<=now;
   return '<article class="memory-mini-card '+(r.mark==='unfamiliar'?'unfamiliar':'')+' '+(r.suspended?'suspended':'')+'"><button class="memory-mini-glyph" data-memory-history="'+c+'"><span>'+c+'</span><small>'+esc(host.py(c))+'</small></button><span class="memory-badge">'+familiarity(r)+'</span><p>'+(r.suspended?'恢复后继续原排期':isDue?'现在可以复习':'下次 '+dateText(r.card.due))+'</p><div class="memory-mini-tools"><button data-memory-flag="'+c+'" aria-label="'+(r.flagged?'取消重点':'标为重点')+c+'">'+(r.flagged?'⚑':'⚐')+'</button><button data-memory-mark="'+c+'">'+(r.mark==='unfamiliar'?'✓ 取消不熟悉':'? 不熟悉')+'</button><button data-memory-history="'+c+'">历史 ↗</button></div></article>';
  }).join(''):'<div class="memory-empty"><span>❧</span><h3>'+(chars.length?'这一组暂时没有汉字':'还没有收藏的汉字')+'</h3><p>'+(chars.length?'换一个筛选条件看看吧。':'到汉字探索里，点 ☆ 收藏不熟悉的字，就能生成复习卡。')+'</p></div>';
  $('#memory-session-size').onchange=e=>{db=load();db.settings.sessionSize=Number(e.target.value);save(db);};
  $('#memory-retention').onchange=e=>{db=load();db.settings.retention=Number(e.target.value);save(db);status('已更新排期目标，现有到期时间保持原样。');};
  $('#memory-import-file').onchange=importFile;
 }
 function weekHTML(chars,now){
  const dates=Array.from({length:7},(_,i)=>new Date(now.getTime()+i*86400000));
  const counts=dates.map((d,i)=>chars.filter(c=>{const r=db.cards[c];if(r.suspended)return false;return i===0?dayKey(r.card.due)<=dayKey(now):dayKey(r.card.due)===dayKey(d);}).length);
  const max=Math.max(1,...counts);
  return dates.map((d,i)=>'<div class="memory-day"><b>'+counts[i]+'</b><span class="memory-day-bar" style="height:'+(5+counts[i]/max*40)+'px"></span><small>'+(i===0?'今天':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'short'}).format(d))+'</small></div>').join('');
 }
 function ensureDialogs(){
  if(!$('#memory-review-dialog')){
   const d=document.createElement('dialog');d.id='memory-review-dialog';d.className='memory-review-dialog';d.setAttribute('aria-label','汉字记忆闪卡');document.body.append(d);
   d.addEventListener('close',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();host.onClose?.();if(host.isCollection())render();});
  }
  if(!$('#memory-history-dialog')){const d=document.createElement('dialog');d.id='memory-history-dialog';d.className='memory-history-dialog';document.body.append(d);}
 }
 function start(mode='scheduled',specific=null){
  ensure();ensureDialogs();
  const now=new Date(),kind=mode==='practice'?'practice':'scheduled';
  const eligible=specific?[specific]:dueCharacters(favorites(),db.cards,now,kind==='practice'?'all':'due');
  const queue=eligible.filter(c=>db.cards[c]&&!db.cards[c].suspended).slice(0,db.settings.sessionSize);
  if(!queue.length){status(kind==='scheduled'?'现在没有到期的卡片，可以稍后再来或自由练习。':'还没有可以练习的字。');render();return;}
  session={mode:kind,queue,initial:queue.length,done:0,skipped:0,ratings:[],revealed:false,busy:false,current:null};undoId=null;
  showCard();if(!$('#memory-review-dialog').open)$('#memory-review-dialog').showModal();
 }
 function currentRow(char){return host.getSegments().find(s=>s.verified&&s.text.includes(char)&&s.words.some(w=>w.includes(char)))||host.getSegments().find(s=>s.text.includes(char)&&s.words.some(w=>w.includes(char)));}
 function showCard(){
  const d=$('#memory-review-dialog');
  if(!session.queue.length){showSummary();return;}
  const char=session.queue[0];session.current=char;session.revealed=false;session.frontAt=Date.now();db=load();session.recordVersion=db.cards[char].updatedAt;
  const progressed=session.done+session.skipped;
  d.innerHTML='<div class="memory-modal-top"><span>'+(session.mode==='scheduled'?'间隔复习':'自由练习 · 不改变排期')+'</span><button data-memory-close aria-label="关闭闪卡">×</button></div><div class="memory-review-progress"><span style="width:'+progressed/session.initial*100+'%"></span></div><div class="memory-card-counter">第 '+(progressed+1)+' / '+session.initial+' 张 <button data-memory-history="'+char+'">这个字的历史 ↗</button></div>'+
  '<div class="memory-flip-stage" id="memory-flip-stage"><div class="memory-face memory-front"><span class="eyebrow">TRY TO REMEMBER</span><div class="memory-front-glyph">'+char+'</div><h3>它怎么读？能说一个词吗？</h3><p>先在心里想一想，或者轻轻说出来。</p><button class="primary" data-memory-reveal>想好啦，翻开答案 <small>空格键</small></button><span class="memory-front-hint">想不起来也可以翻卡，接下来选“重来”。</span></div><div class="memory-face memory-back" id="memory-back" hidden></div></div>'+
  '<div id="memory-ratings" class="memory-ratings hidden"></div><div class="memory-review-bottom"><button data-memory-skip>这张稍后再看</button><button data-memory-undo '+(!undoId?'disabled':'')+'>↶ 撤销上一张</button><button data-memory-flag="'+char+'">'+(db.cards[char].flagged?'⚑ 已标重点':'⚐ 标为重点')+'</button></div>';
  d.querySelector('[data-memory-reveal]')?.focus();
 }
 function reveal(){
  if(!session||session.revealed||!session.queue.length)return;
  session.revealed=true;const char=session.current,r=db.cards[char],row=currentRow(char),back=$('#memory-back');
  back.hidden=false;$('#memory-flip-stage').classList.add('revealed');
  $('#memory-flip-stage .memory-front').setAttribute('aria-hidden','true');
  $('#memory-flip-stage .memory-front').inert=true;
  const readings=host.py(char,{multiple:true,type:'array'});
  back.innerHTML='<div class="memory-answer-title"><span>'+char+'</span><div><b>'+esc(host.py(char))+'</b><p>'+(readings.length>1?'多音字 '+esc(readings.join(' / ')):'跟着词语一起记')+'</p><button data-memory-speak="'+char+'">◖)) 听读音</button></div></div><div class="memory-answer-grid"><div><div id="memory-stroke" class="memory-stroke"></div><p id="memory-stroke-note">正在看笔顺…</p></div><div class="memory-answer-context">'+(row?'<div class="word-tags">'+row.words.filter(w=>w.includes(char)).slice(0,3).map(w=>'<button data-memory-speak="'+esc(w)+'">'+esc(w)+'<small>'+esc(host.py(w))+'</small></button>').join('')+'</div><blockquote>'+esc(row.text)+'</blockquote><small>'+esc(host.bookTitle(row.book))+' · PDF '+row.page+' 页'+(!row.verified?' · 扫描识别，需核对':'')+'</small>':'<p>这个字的原文词句还在整理中。先听读音，看看笔顺吧。</p>')+'</div></div><button class="memory-open-lesson" data-memory-learn="'+char+'">回到学习页，读更多语句 →</button>';
  const now=new Date(),p=preview(r,now,db.settings.retention);
  $('#memory-ratings').innerHTML=[1,2,3,4].map(n=>'<button class="memory-rating grade-'+n+'" data-memory-rate="'+n+'"><b>'+RATINGS[n]+'</b><span>'+['','没想起来','想起来但费力','独立想起来','很轻松，很确定'][n]+'</span><small>'+(session.mode==='practice'?'记录这次表现':intervalText(p[n].card.due,now)+'后再见')+'</small><kbd>'+n+'</kbd></button>').join('')+'<p>忘记请选择“重来”；“困难”表示已经想起来，只是有点费力。</p>';
  $('#memory-ratings').classList.remove('hidden');
  $('#memory-ratings button').focus();
  const currentSession=session;
  HanziData.load('data/'+char.codePointAt(0)+'.json').then(data=>{
   if(session!==currentSession||session.current!==char||!$('#memory-stroke'))return;
   const w=HanziWriter.create('memory-stroke',char,{width:165,height:165,padding:16,strokeColor:'#365b44',outlineColor:'#e4e9d9',charDataLoader:()=>Promise.resolve(data),delayBetweenStrokes:220});
   $('#memory-stroke-note').textContent=data.strokes.length+' 画 · 看清顺序再记一记';w.animateCharacter();
  }).catch(()=>{if(session===currentSession&&session.current===char&&$('#memory-stroke')){$('#memory-stroke').textContent=char;$('#memory-stroke-note').textContent='这个字暂缺笔顺，先记读音和用法。';}});
 }
 function rate(rating){
  if(!session?.revealed||session.busy||!session.queue.length)return;
  session.busy=true;const char=session.current,now=new Date();db=load();const before=copy(db.cards[char]);
  if(before.updatedAt!==session.recordVersion){session.busy=false;status('这个字在另一处发生了更新，请重新翻卡核对。');showCard();return;}
  if(before.suspended){session.busy=false;skip();return;}
  let after,algorithmLog=null;
  if(session.mode==='scheduled'){const result=reviewRecord(before,rating,now,db.settings.retention);after=result.record;algorithmLog=result.log;}
  else after={...before,updatedAt:now.toISOString()};
  const entry={id:uid(),char,rating,mode:session.mode,at:now.toISOString(),durationMs:Math.max(0,Date.now()-session.frontAt),nextDue:new Date(after.card.due).toISOString(),before,afterUpdatedAt:after.updatedAt,algorithmLog,undone:false};
  const next=copy(db);next.cards[char]=after;next.logs.push(entry);
  try{save(next);}catch{session.busy=false;status('浏览器没有保存成功，本张还未计入复习。请先导出备份。');return;}
  undoId=entry.id;session.done++;session.ratings.push(rating);session.queue.shift();session.busy=false;host.chime();showCard();
 }
 function skip(){if(!session?.queue.length)return;session.skipped++;session.queue.shift();showCard();}
 function undo(){
  if(!undoId||!session)return;db=load();const log=db.logs.find(l=>l.id===undoId);
  if(!log||log.undone||db.cards[log.char].updatedAt!==log.afterUpdatedAt){status('这张卡之后已有变化，无法撤销这一次排期。');return;}
  const next=copy(db);next.cards[log.char]=log.before;next.logs.find(l=>l.id===log.id).undone=true;
  save(next);session.queue.unshift(log.char);session.done=Math.max(0,session.done-1);session.ratings.pop();undoId=null;showCard();status('已撤销上一张，原排期已经恢复。');
 }
 function showSummary(){
  const d=$('#memory-review-dialog'),count=session.done;
  d.innerHTML='<div class="memory-modal-top"><span>这一小段旅程结束啦</span><button data-memory-close aria-label="关闭闪卡">×</button></div><div class="memory-summary"><span>❧</span><h2>又和 '+count+' 个汉字见了面</h2><p>'+(session.mode==='scheduled'?'已经根据你的回忆情况，安排下一次见面。':'这次为自由练习，原来的复习排期保持原样。')+'</p><div class="memory-summary-grades">'+[1,2,3,4].map(n=>'<span class="grade-'+n+'">'+RATINGS[n]+' <b>'+session.ratings.filter(x=>x===n).length+'</b></span>').join('')+'</div>'+(session.skipped?'<small>本轮略过 '+session.skipped+' 张，未写入评分。</small>':'')+'<p>忘记不是失败。下一次想起来，就是进步。</p><button class="primary" data-memory-close>回到记忆森林</button><button data-memory-undo '+(!undoId?'disabled':'')+'>↶ 撤销上一张</button></div>';
  render();
 }
 function changeRecord(char,operation,label){
  ensure();if(!db.cards[char])return;const next=copy(db);operation(next.cards[char]);next.cards[char].updatedAt=new Date().toISOString();
  next.events.push({id:uid(),char,type:'mark',label,at:next.cards[char].updatedAt});save(next);
  if(host.isCollection())render();if(historyChar===char&&$('#memory-history-dialog')?.open)showHistory(char);status(label+'“'+char+'”。');
 }
 function curveHTML(r){
  if(!r.card.reps||!r.card.last_review)return '<p class="muted">第一次复习后，这里会出现排期和记忆状态的变化。</p>';
  const start=new Date(r.card.last_review),days=Math.min(60,Math.max(2,Math.ceil((r.card.scheduled_days||3)*2))),points=[];
  for(let i=0;i<=32;i++){const p=retrievability(r,new Date(start.getTime()+days*86400000*i/32),db.settings.retention);points.push([20+i*10,20+(1-(p??1))*80]);}
  const line=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  return '<div class="memory-curve"><h4>时间过去，记忆也会变化</h4><svg viewBox="0 0 360 130" role="img" aria-label="FSRS 模型对未来'+days+'天回忆可能性的估计"><line x1="20" y1="100" x2="340" y2="100" stroke="#dfe5d4"/><line x1="20" y1="28" x2="340" y2="28" stroke="#cfb875" stroke-dasharray="3 4"/><path d="'+line+' L340,100 L20,100Z" fill="#8da66b22"/><path d="'+line+'" fill="none" stroke="#6d8e52" stroke-width="2.5"/><text x="20" y="120">复习当时</text><text x="285" y="120">'+days+'天后</text><text x="20" y="14">预计回忆可能性</text></svg><p>这条线是 FSRS 模型估计，不是对孩子记忆力的实测，也不代表每个人都按同一曲线遗忘。</p></div>';
 }
 function showHistory(char){
  ensure();ensureDialogs();historyChar=char;const r=db.cards[char],logs=logFor(char),d=$('#memory-history-dialog');
  const events=[...db.logs.filter(l=>l.char===char).map(l=>({...l,type:'review'})),...db.events.filter(e=>e.char===char)].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  d.innerHTML='<div class="memory-modal-top"><span>汉字的回忆足迹</span><button data-memory-history-close aria-label="关闭复习历史">×</button></div><div class="memory-history-heading"><span>'+char+'</span><div><h2>'+esc(host.py(char))+'</h2><p>'+familiarity(r)+' · 共复习 '+logs.length+' 次</p></div></div><div class="memory-history-actions"><button data-memory-mark="'+char+'">'+(r.mark==='unfamiliar'?'✓ 取消不熟悉':'? 标为不熟悉')+'</button><button data-memory-flag="'+char+'">'+(r.flagged?'⚑ 取消重点':'⚐ 标为重点')+'</button><button data-memory-suspend="'+char+'">'+(r.suspended?'恢复排期':'暂停这张卡')+'</button></div><p class="memory-next-due">'+(r.suspended?'已暂停，不进入到期复习队列':'下次复习：'+dateText(r.card.due))+'</p><button class="primary" data-memory-one="'+char+'" '+(r.suspended?'disabled':'')+'>'+(!r.suspended&&new Date(r.card.due)<=new Date()?'复习这个字':'自由练一下（不改排期）')+'</button>'+curveHTML(r)+'<h3 class="memory-history-title">历史回顾</h3><div class="memory-timeline">'+events.slice(0,historyLimit).map(e=>e.type==='review'?'<article class="'+(e.undone?'undone':'')+'"><span class="memory-timeline-dot grade-'+e.rating+'"></span><div><b>'+RATINGS[e.rating]+(e.undone?' · 已撤销':'')+'</b><small>'+dateText(e.at)+' · '+(e.mode==='practice'?'自由练习':'间隔复习')+'</small><p>'+(e.mode==='practice'?'这次只记录表现，排期未改动。':'下一次：'+dateText(e.nextDue))+'</p></div></article>':'<article><span class="memory-timeline-dot"></span><div><b>'+esc(e.label)+'</b><small>'+dateText(e.at)+'</small></div></article>').join('')+'</div>'+(events.length>historyLimit?'<button data-memory-history-more>再看更早的记录</button>':'');
  if(!d.open)d.showModal();
 }
 function exportData(){
  let data;try{data=load();}catch{data={unreadableOriginal:localStorage.getItem(KEY)};}
  const out={...data,favorites:host.getFavorites(),exportedAt:new Date().toISOString(),engine:'ts-fsrs 5.4.2'};
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='记忆森林-'+dayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function importFile(e){
  const file=e.target.files[0];if(!file)return;if(file.size>6*1024*1024){status('备份过大，请选择 6 MB 以内的记忆森林 JSON 文件。');return;}
  try{const incoming=JSON.parse(await file.text()),current=load(),valid=validChars();if(incoming.favorites!==undefined&&!Array.isArray(incoming.favorites))throw Error('收藏列表格式无效');const merged=mergeBackup(current,incoming,valid);const imported=(incoming.favorites||Object.keys(incoming.cards)).filter(c=>valid.has(c));save(merged);host.addFavorites(imported);render();status('备份已合并，重复历史不会再次添加。');}catch(error){status('没有导入：'+error.message+'。原有记录保持不变。');}
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  try{
   if(b.dataset.memoryStart)start(b.dataset.memoryStart==='due'?'scheduled':'practice');
   if(b.dataset.memoryFilter){filter=b.dataset.memoryFilter;render();}
   if(b.hasAttribute('data-memory-reveal'))reveal();
   if(b.hasAttribute('data-memory-rate'))rate(Number(b.dataset.memoryRate));
   if(b.hasAttribute('data-memory-skip'))skip();
   if(b.hasAttribute('data-memory-undo'))undo();
   if(b.hasAttribute('data-memory-close'))$('#memory-review-dialog').close();
   if(b.dataset.memoryHistory){historyLimit=30;showHistory(b.dataset.memoryHistory);}
   if(b.hasAttribute('data-memory-history-close')){$('#memory-history-dialog').close();historyChar=null;}
   if(b.hasAttribute('data-memory-history-more')){historyLimit+=30;showHistory(historyChar);}
   if(b.dataset.memoryFlag){const c=b.dataset.memoryFlag,r=record(c);changeRecord(c,x=>x.flagged=!x.flagged,r.flagged?'已取消重点':'已标为重点');}
   if(b.dataset.memoryMark){const c=b.dataset.memoryMark,r=record(c);changeRecord(c,x=>x.mark=x.mark==='unfamiliar'?'normal':'unfamiliar',r.mark==='unfamiliar'?'已取消不熟悉标记':'已标记为不熟悉');}
   if(b.dataset.memorySuspend){const c=b.dataset.memorySuspend,r=record(c);changeRecord(c,x=>x.suspended=!x.suspended,r.suspended?'已恢复排期':'已暂停');}
   if(b.dataset.memoryOne){const c=b.dataset.memoryOne,r=record(c);$('#memory-history-dialog').close();start(new Date(r.card.due)<=new Date()?'scheduled':'practice',c);}
   if(b.dataset.memorySpeak)host.speak(b.dataset.memorySpeak);
   if(b.dataset.memoryLearn){$('#memory-review-dialog').close();host.learn(b.dataset.memoryLearn);}
   if(b.hasAttribute('data-memory-export'))exportData();
  }catch(error){status('暂时无法完成：'+error.message);}
 });
 document.addEventListener('keydown',e=>{
  if(!$('#memory-review-dialog')?.open||$('#memory-history-dialog')?.open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.code==='Space'){e.preventDefault();reveal();}
  if(session?.revealed&&['1','2','3','4'].includes(e.key)){e.preventDefault();rate(Number(e.key));}
 });
 window.addEventListener('storage',e=>{if(e.key===KEY&&host.isCollection()&&!$('#memory-review-dialog')?.open)render();});
 window.addEventListener('focus',()=>{if(host.isCollection()&&!$('#memory-review-dialog')?.open)render();});
 return {render,start,ensure};
}

