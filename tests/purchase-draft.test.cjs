const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-ts.cjs');
const {emptyPurchaseDraft,choosePurchaseDraft,migratePurchaseDraft,suggestDeliveries,addSuggestedDelivery}=load('src/lib/purchase-draft.ts');
const {validatePlan,nextAvailableDate,addDateDays,allocated,planCount}=load('src/lib/scheduling.ts');

test('guest login carries the complete draft, including review, editor and delivery preference',()=>{
 const guest={...emptyPurchaseDraft(),items:[{tempId:'meal',quantity:4}],mode:'scheduled',step:3,plans:[{id:'delivery',date:'2030-01-07',quantities:{meal:2},period:'Noite'}],editor:{...emptyPurchaseDraft().editor,notes:'Sem coentro'}};
 const result=choosePurchaseDraft(emptyPurchaseDraft(),guest,true);
 assert.deepEqual(result,{draft:guest,conflict:false,consumeGuest:true});
 const conflict=choosePurchaseDraft({...emptyPurchaseDraft(),items:[{tempId:'saved',quantity:2}]},guest,true);
 assert.equal(conflict.conflict,true);assert.equal(conflict.consumeGuest,false);assert.equal(conflict.draft.items[0].tempId,'saved');
 assert.deepEqual(choosePurchaseDraft(emptyPurchaseDraft(),guest,false).draft,emptyPurchaseDraft());
});
test('legacy draft migration preserves flavors and plans without reintroducing a required quantity target',()=>{
 const items=[{tempId:'meal',quantity:2}];const plans=[{id:'d',date:'2030-01-07',quantities:{meal:2},period:'Tarde'}];
 const draft=migratePurchaseDraft(items,{target:20,plans,mode:'scheduled',tab:'custom',quantity:3,notes:'Teste'});
 assert.deepEqual(draft.items,items);assert.deepEqual(draft.plans,plans);assert.equal(draft.editor.quantity,3);assert.equal(draft.editor.notes,'Teste');assert.equal('target' in draft,false);
});
test('suggested deliveries preserve each flavor, avoid single leftovers and respect capacity',()=>{
 for(const quantities of [[2],[3],[4],[5],[121],[241],[2,3,5],[119,3,121]]){
  const items=quantities.map((quantity,i)=>({tempId:'item'+i,quantity}));const date=nextAvailableDate();const capacity={[date]:118};
  const plans=suggestDeliveries(items,capacity,7);assert.equal(validatePlan(items,plans,capacity,true),null,JSON.stringify(quantities));
  for(const item of items)assert.equal(allocated(plans,item.tempId),item.quantity);
  for(const plan of plans)assert.ok(planCount(plan)+(capacity[plan.date]||0)<=120);
 }
});
test('adding a delivery suggests a valid split instead of creating empty rows',()=>{
 const items=[{tempId:'meal',quantity:5}];const plans=suggestDeliveries(items,{});const next=addSuggestedDelivery(items,plans,{});
 assert.equal(next.length,2);assert.equal(validatePlan(items,next,{},true),null);assert.deepEqual(next.map(p=>p.quantities.meal),[3,2]);
 const tooSmall=[{tempId:'small',quantity:3}];const single=suggestDeliveries(tooSmall,{});assert.equal(addSuggestedDelivery(tooSmall,single,{}),single);
});
test('suggestions use unassigned balance and skip occupied or full dates',()=>{
 const items=[{tempId:'meal',quantity:6}];const first=nextAvailableDate();const plans=[{id:'existing',date:first,quantities:{meal:2}}];
 const blocked=addDateDays(first,7);const next=addSuggestedDelivery(items,plans,{[blocked]:120});
 assert.equal(next.length,2);assert.notEqual(next[1].date,blocked);assert.equal(validatePlan(items,next,{[blocked]:120},true),null);
});
