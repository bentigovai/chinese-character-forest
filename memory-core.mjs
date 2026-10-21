import {fsrs,createEmptyCard,State} from './vendor/fsrs.mjs';
export const SCHEMA=1;
export const RATINGS={1:'重来',2:'困难',3:'记住',4:'熟练'};
export function hydrateCard(raw){
 const card={...raw,due:new Date(raw.due)};
 if(raw.last_review)card.last_review=new Date(raw.last_review);else delete card.last_review;
 if(!Number.isFinite(card.due.getTime())||card.last_review&&!Number.isFinite(card.last_review.getTime()))throw Error('复习日期无效');
 return card;
}
export function makeScheduler(retention=.9){return fsrs({request_retention:retention,maximum_interval:365,enable_fuzz:false,enable_short_term:true});}
export function newRecord(now=new Date()){return {card:createEmptyCard(now),mark:'normal',flagged:false,suspended:false,createdAt:now.toISOString(),updatedAt:now.toISOString()};}
export function preview(record,now=new Date(),retention=.9){return makeScheduler(retention).repeat(hydrateCard(record.card),now);}
export function reviewRecord(record,rating,now=new Date(),retention=.9){
 if(!RATINGS[rating])throw Error('评分无效');
 const result=makeScheduler(retention).next(hydrateCard(record.card),now,rating);
 return {record:{...record,card:result.card,mark:rating<=2?'unfamiliar':rating===4?'familiar':'normal',updatedAt:now.toISOString()},log:result.log};
}
export function dueCharacters(favorites,cards,now=new Date(),filter='due'){
 return favorites.filter(c=>cards[c]&&!cards[c].suspended&&(filter!=='due'||new Date(cards[c].card.due).getTime()<=now.getTime()))
 .sort((a,b)=>Number(cards[b].flagged)-Number(cards[a].flagged)||Number(cards[b].mark==='unfamiliar')-Number(cards[a].mark==='unfamiliar')||new Date(cards[a].card.due)-new Date(cards[b].card.due));
}
export function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));}
export function validRecord(record){
 if(!record||!record.card||!['normal','unfamiliar','familiar'].includes(record.mark)||typeof record.flagged!=='boolean'||typeof record.suspended!=='boolean')return false;
 try{const c=hydrateCard(record.card);if(![0,1,2,3].includes(c.state))return false;
 for(const key of ['stability','difficulty','elapsed_days','scheduled_days','reps','lapses','learning_steps'])if(!Number.isFinite(c[key])||c[key]<0)return false;
 return Number.isFinite(Date.parse(record.createdAt))&&Number.isFinite(Date.parse(record.updatedAt));
 }catch{return false;}
}
export function mergeBackup(current,incoming,validChars){
 if(incoming?.schema!==SCHEMA||incoming?.app!=='hanzi-forest-memory'||!incoming.cards||!Array.isArray(incoming.logs)||!Array.isArray(incoming.events))throw Error('这不是有效的记忆森林备份');
 const out=JSON.parse(JSON.stringify(current));
 for(const [char,record]of Object.entries(incoming.cards)){
  if(!validChars.has(char)||!validRecord(record))throw Error('备份中有无效汉字或排期');
  if(!out.cards[char]||Date.parse(record.updatedAt)>Date.parse(out.cards[char].updatedAt))out.cards[char]=record;
 }
 const ids=new Set(out.logs.map(x=>x.id));
 for(const log of incoming.logs){
  if(typeof log.id!=='string'||!validChars.has(log.char)||!RATINGS[log.rating]||!Number.isFinite(Date.parse(log.at))||!['scheduled','practice'].includes(log.mode)||!Number.isFinite(Date.parse(log.nextDue)))throw Error('备份中的复习历史无效');
  if(log.before&&!validRecord(log.before))throw Error('备份中的历史排期无效');
  if(!ids.has(log.id)){out.logs.push(log);ids.add(log.id);}
 }
 const eventIds=new Set(out.events.map(x=>x.id));
 for(const event of incoming.events){
  if(typeof event.id!=='string'||!validChars.has(event.char)||!Number.isFinite(Date.parse(event.at)))throw Error('备份中的标记记录无效');
  if(!eventIds.has(event.id)){out.events.push(event);eventIds.add(event.id);}
 }
 return out;
}
export function retrievability(record,now=new Date(),retention=.9){
 if(record.card.state===State.New||!record.card.last_review)return null;
 return makeScheduler(retention).get_retrievability(hydrateCard(record.card),now,false);
}

