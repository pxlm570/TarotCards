import { beforeEach, describe, expect, it } from 'vitest'
import { createReadingRecord, resolveReadingSpread, snapshotSpread } from '../src/lib/reading-record.js'
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

describe('snapshotSpread 拒收边界',()=>{
 const pos=(key,x=50,y=50,extra={})=>({key,label:key,x,y,...extra})
 const spreadWith=(positions)=>({id:'s',name:'阵',positions})

 it('spread 级缺 id/name、positions 非数组/空/超 10 位 → null',()=>{
  expect(snapshotSpread(null)).toBeNull()
  expect(snapshotSpread({name:'无id',positions:[pos('p1')]})).toBeNull()
  expect(snapshotSpread({id:'s',positions:[pos('p1')]})).toBeNull()
  expect(snapshotSpread({id:123,name:'阵',positions:[pos('p1')]})).toBeNull()
  expect(snapshotSpread({id:'s',name:'阵'})).toBeNull()
  expect(snapshotSpread({id:'s',name:'阵',positions:{}})).toBeNull()
  expect(snapshotSpread({id:'s',name:'阵',positions:[]})).toBeNull()
  const many=Array.from({length:11},(_,i)=>pos(`k${i}`,10,10))
  expect(snapshotSpread(spreadWith(many))).toBeNull()
 })
 it('position 级缺 key/label、key 空串、重复 key、null 位 → null',()=>{
  expect(snapshotSpread(spreadWith([null]))).toBeNull()
  expect(snapshotSpread(spreadWith([{label:'无key',x:1,y:1}]))).toBeNull()
  expect(snapshotSpread(spreadWith([{key:'',label:'空key',x:1,y:1}]))).toBeNull()
  expect(snapshotSpread(spreadWith([{key:'p1',x:1,y:1}]))).toBeNull()
  expect(snapshotSpread(spreadWith([pos('p1'),pos('p1')]))).toBeNull()
 })
 it('x/y 非有限数或越界（<0 或 >100）→ null；0 与 100 合法',()=>{
  for (const v of [NaN,Infinity,-Infinity,undefined,'50',-1,101]) {
   expect(snapshotSpread(spreadWith([{key:'p1',label:'位',x:v,y:50}]))).toBeNull()
   expect(snapshotSpread(spreadWith([{key:'p1',label:'位',x:50,y:v}]))).toBeNull()
  }
  expect(snapshotSpread(spreadWith([pos('p1',0,100)]))).not.toBeNull()
 })
 it('合法 spread：meaning 缺省空串、rotate 有保无弃、cardCount 对齐',()=>{
  const snap=snapshotSpread(spreadWith([
   {key:'p1',label:'过去',x:10,y:20,rotate:-90},
   {key:'p2',label:'现在',x:30,y:20,rotate:'45'},
   {key:'p3',label:'未来',x:50,y:20,rotate:NaN},
  ]))
  expect(snap.cardCount).toBe(3)
  expect(snap.positions[0]).toEqual({key:'p1',label:'过去',meaning:'',x:10,y:20,rotate:-90})
  expect(snap.positions[1].rotate).toBeUndefined()
  expect(snap.positions[2].rotate).toBeUndefined()
  expect(snap.positions[1].meaning).toBe('')
 })
})

describe('createReadingRecord / resolveReadingSpread 边界',()=>{
 const pos=(key,x=50,y=50,extra={})=>({key,label:key,x,y,...extra})
 const spreadWith=(positions)=>({id:'s',name:'阵',positions})

 it('非法 spread 时 spreadSnapshot 为 null；合法时 cards 收敛映射 + isDaily 布尔化',()=>{
  const bad=createReadingRecord({spreadId:'s',spread:{name:'缺positions'},drawn:[],question:'',isDaily:1},'r1','')
  expect(bad.spreadSnapshot).toBeNull()
  expect(bad.isDaily).toBe(true)
  const good=createReadingRecord({
   spreadId:'s',spread:spreadWith([pos('p1'),pos('p2')]),
   drawn:[{cardId:'major-00',positionKey:'p1',reversed:false,extra:'多余'}],
   question:'问题',domain:'关系',isDaily:undefined,
  },'r2','')
  expect(good.spreadSnapshot.cardCount).toBe(2)
  expect(good.cards).toEqual([{cardId:'major-00',positionKey:'p1',reversed:false}])
  expect('extra' in good.cards[0]).toBe(false)
  expect(good.isDaily).toBe(false)
  expect(good.domain).toBe('关系')
 })
 it('note 缺省得空串，domain 缺省归 null',()=>{
  const r=createReadingRecord({spreadId:'s',drawn:[],question:'',isDaily:false},'r3')
  expect(r.note).toBe('')
  expect(r.domain).toBeNull()
 })
 it('snapshot 与 spreadId 不一致回退注册表，都无则 null',()=>{
  const snap=snapshotSpread(spreadWith([pos('p1')]))
  const registry=[{id:'single',name:'单牌',positions:[]}]
  expect(resolveReadingSpread({spreadId:'single',spreadSnapshot:snap},registry).id).toBe('single')
  expect(resolveReadingSpread({spreadId:'gone',spreadSnapshot:snap},[])).toBeNull()
  expect(resolveReadingSpread(null,registry)).toBeNull()
 })
})
