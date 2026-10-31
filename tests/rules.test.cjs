const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
function load(file) {
 const m = new Module(file, module);
 m.filename=file;m.paths=module.paths;
 m.require=(id)=>id==='@/lib/scheduling'?scheduling:require(id);
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
 return m.exports;
}
const scheduling = load('src/lib/scheduling.ts');
const rules = load('src/lib/rules.ts');
const {validatePlan,capacityFromOrders,isProductionDate,todayInSaoPaulo,productionOrders}=scheduling;
const today='2026-09-27';
const item=(id,quantity)=>({tempId:id,quantity});
const plan=(date,quantities)=>({id:date,date,quantities});
test('São Paulo calendar ignores UTC midnight until local midnight',()=>{
 assert.equal(todayInSaoPaulo(new Date('2026-09-28T01:00:00Z')),'2026-09-27');
 assert.equal(todayInSaoPaulo(new Date('2026-09-28T03:00:00Z')),'2026-09-28');
});
test('only Monday Wednesday Friday, tomorrow onwards, real dates',()=>{
 assert.equal(isProductionDate('2026-09-28',today),true);
 assert.equal(isProductionDate('2026-09-30',today),true);
 assert.equal(isProductionDate('2026-10-02',today),true);
 assert.equal(isProductionDate('2026-09-29',today),false);
 assert.equal(isProductionDate('2026-09-28','2026-09-28'),false);
 assert.equal(isProductionDate('2026-02-30','2026-01-01'),false);
});
test('pricing preserves current tiers including 100 units',()=>{
 for(const [q,total] of [[10,180],[12,208],[20,320],[25,385],[30,450],[31,434],[100,1400]])
 assert.equal(rules.calculateVolumePrice(q).totalPrice,total);
});
test('100 units distributed across weeks with flavor balance',()=>{
 const plans=[plan('2026-09-28',{a:20,b:10}),plan('2026-10-05',{a:20,b:20})];
 assert.equal(validatePlan([item('a',60),item('b',40)],plans,{},false,today),null);
 assert.match(validatePlan([item('a',60),item('b',40)],plans,{},true,today),/todas/);
});
test('one per flavor and remainder of one are rejected, three is valid',()=>{
 assert.match(validatePlan([item('a',4)],[plan('2026-09-28',{a:1})],{},false,today),/mínimo 2/);
 assert.match(validatePlan([item('a',4)],[plan('2026-09-28',{a:3})],{},false,today),/sobrar apenas 1/);
 assert.equal(validatePlan([item('a',3)],[plan('2026-09-28',{a:3})],{},true,today),null);
});
test('no negative, fractional, unknown, duplicate, empty or over-allocation',()=>{
 for(const qty of [-2,1.5,NaN]) assert.ok(validatePlan([item('a',4)],[plan('2026-09-28',{a:qty})],{},false,today));
 assert.ok(validatePlan([item('a',4)],[plan('2026-09-28',{x:2})],{},false,today));
 assert.ok(validatePlan([item('a',4)],[plan('2026-09-28',{a:2}),plan('2026-09-28',{a:2})],{},false,today));
 assert.ok(validatePlan([item('a',4)],[plan('2026-09-28',{})],{},false,today));
 assert.ok(validatePlan([item('a',4)],[plan('2026-09-28',{a:6})],{},false,today));
});
test('daily limit is meal units, paid only, aggregated across customers',()=>{
 const plans=[plan('2026-09-28',{a:60})];
 const orders=[{id:'1',status:'pending',deliveries:plans},{id:'2',status:'paid',deliveries:plans},{id:'3',status:'preparing',deliveries:[plan('2026-09-28',{b:58})]}];
 assert.equal(capacityFromOrders(orders)['2026-09-28'],118);
 assert.equal(validatePlan([item('a',2)],[plan('2026-09-28',{a:2})],capacityFromOrders(orders),true,today),null);
 assert.ok(validatePlan([item('a',3)],[plan('2026-09-28',{a:3})],capacityFromOrders(orders),true,today));
});
test('kitchen and shopping report use allocation per delivery',()=>{
 const orders=[{id:'1',status:'paid',quantity_meals:10,items:[{id:'a',quantity:10}],deliveries:[plan('2026-09-28',{a:4}),plan('2026-10-05',{a:6})]}];
 const result=productionOrders(orders);
 assert.deepEqual(result.map(o=>[o.delivery_date,o.quantity_meals,o.items[0].quantity]),[['2026-09-28',4,4],['2026-10-05',6,6]]);
 assert.equal(productionOrders([{...orders[0],status:'pending'}]).length,0);
});
test('next available date skips full days and allows exact capacity',()=>{
 const first=scheduling.nextAvailableDate();
 const second=scheduling.nextAvailableDate(first,{[first]:120},2);
 assert.ok(second>first);
 assert.equal(scheduling.nextAvailableDate(first,{[first]:118},2),first);
 assert.equal(scheduling.nextAvailableDate(undefined,{},121),'');
});
