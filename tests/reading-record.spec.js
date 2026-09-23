import { beforeEach, describe, expect, it } from 'vitest'
import { createReadingRecord, resolveReadingSpread } from '../src/lib/reading-record.js'
import { saveReading, getById } from '../src/lib/journal-store.js'
import { applyImport, collectBackup } from '../src/lib/backup.js'
beforeEach(()=>localStorage.clear())
describe('历史牌阵语义快照',()=>{
 it('编辑或删除原牌阵不改变旧记录，备份往返保留快照',()=>{
  const spread={id:'custom-one',name:'原名',cardCount:1,positions:[{key:'p1',label:'我的想法',meaning:'看自己',x:20,y:50}]}
  const state={spreadId:spread.id,spread,drawn:[{cardId:'major-00',positionKey:'p1',reversed:false}],question:'问题',domain:null,isDaily:false}
  const record=createReadingRecord(state,'r','笔记')
  spread.positions[0].label='对方想法';spread.positions[0].x=80
  saveReading(record)
  expect(resolveReadingSpread(getById('r'),[spread]).positions[0].label).toBe('我的想法')
  const backup=collectBackup();localStorage.clear();applyImport(backup,'overwrite')
  expect(resolveReadingSpread(getById('r'),[]).positions[0].x).toBe(20)
 })
 it('自由摆放同样保存坐标，旧记录仍能回退注册表',()=>{
  const spread={id:'free',name:'自由摆放',positions:[{key:'p1',label:'位置',x:70,y:25}]}
  const record=createReadingRecord({spread,spreadId:'free',drawn:[],question:'',isDaily:false},'free-r','')
  expect(resolveReadingSpread(record,[]).positions[0].x).toBe(70)
  expect(resolveReadingSpread({spreadId:'single'},[{id:'single',positions:[]}]).id).toBe('single')
 })
})
