const test=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-ts.cjs');
const {monthDays,shiftMonth,productionDayStatus}=load('src/lib/production-calendar.ts');
test('calendar weeks start Monday and cover leap February and year transitions',()=>{
 const feb=monthDays('2028-02-20');assert.equal(feb[0],'2028-01-31');assert.ok(feb.includes('2028-02-29'));assert.equal(feb.length%7,0);assert.equal(feb.at(-1),'2028-03-05');
 assert.equal(shiftMonth('2026-12-31',1),'2027-01-01');assert.equal(shiftMonth('2027-01-31',-1),'2026-12-01');
 for(let month=1;month<=12;month++){const days=monthDays('2026-'+String(month).padStart(2,'0')+'-01');assert.equal(new Date(days[0]+'T12:00Z').getUTCDay(),1);assert.equal(new Set(days).size,days.length);}
});
test('calendar distinguishes no-production, closures, full and available dates',()=>{
 assert.equal(productionDayStatus('2026-11-01',{},{}),'Sem produção');
 assert.equal(productionDayStatus('2026-11-02',{'2026-11-02':0},{}),'Bloqueada');
 assert.equal(productionDayStatus('2026-11-02',{'2026-11-02':180},{'2026-11-02':180}),'Lotada');
 assert.equal(productionDayStatus('2026-11-02',{'2026-11-02':180},{'2026-11-02':120}),'Disponível');
});
