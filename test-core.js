"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("未找到 <script>"); process.exit(2); }
const code = m[1];

function makeEl() {
  const store = {};
  const handler = {
    get(t, prop) {
      if (prop === "classList") return { add(){}, remove(){}, toggle(){}, contains(){return false;} };
      if (prop === "style") { if (!store.style) store.style = {}; return store.style; }
      if (prop === "dataset") { if (!store.dataset) store.dataset = {}; return store.dataset; }
      if (prop in store) return store[prop];
      if (prop === "querySelector") return () => makeEl();
      if (prop === "querySelectorAll") return () => [];
      if (prop === "getElementById") return () => makeEl();
      if (prop === "createElement") return () => makeEl();
      if (prop === "createDocumentFragment") return () => makeEl();
      if (prop === "appendChild") return () => {};
      if (prop === "removeChild") return () => {};
      if (prop === "addEventListener") return () => {};
      if (prop === "removeEventListener") return () => {};
      if (prop === "setAttribute") return () => {};
      if (prop === "getAttribute") return () => null;
      if (prop === "focus") return () => {};
      if (prop === "click") return () => {};
      if (prop === "close") return () => {};
      if (prop === "showModal") return () => {};
      if (prop === "value") return store.value != null ? store.value : "";
      if (prop === "checked") return store.checked != null ? store.checked : false;
      if (prop === "hidden") return store.hidden != null ? store.hidden : false;
      if (prop === "open") return store.open != null ? store.open : false;
      if (prop === "textContent") return store.textContent != null ? store.textContent : "";
      if (prop === "innerHTML") return store.innerHTML != null ? store.innerHTML : "";
      if (prop === "files") return null;
      return () => {};
    },
    set(t, prop, val) { store[prop] = val; return true; }
  };
  return new Proxy({}, handler);
}

const ls = new Map();
const sandbox = {
  console: console,
  setTimeout: (f, n) => setTimeout(f, n),
  clearTimeout: (id) => clearTimeout(id),
  localStorage: {
    getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: (k, v) => { ls.set(k, String(v)); },
    removeItem: (k) => { ls.delete(k); }
  },
  document: {
    getElementById: () => makeEl(),
    createElement: () => makeEl(),
    createDocumentFragment: () => makeEl(),
    querySelector: () => makeEl(),
    body: makeEl()
  },
  window: {},
  crypto: { randomUUID: () => "uuid-" + Math.random().toString(36).slice(2) },
  Blob: function(){},
  URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
  confirm: () => true,
  Date: Date,
  Math: Math,
  Array: Array,
  Object: Object,
  JSON: JSON,
  Number: Number,
  String: String,
  Set: Set,
  Map: Map,
  Error: Error
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox);
} catch (e) {
  console.error("脚本执行出错：", e && e.stack ? e.stack : e);
  process.exit(2);
}

const yx = sandbox.__yx;
if (!yx) { console.error("未暴露 __yx"); process.exit(2); }

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
}
function vOk(name, arr) { ok(name, yx.validateTaskArray(arr).ok === true); }
function vBad(name, arr) {
  const r = yx.validateTaskArray(arr);
  ok(name + (r.ok ? "" : "  («" + r.error + "»)"), r.ok === false);
}

const T = (id, title, minutes, done) => ({ id, title, minutes, done });

console.log("\n[1] 合法数据");
vOk("空数组", []);
vOk("单项合法", [T("a", "参观博物馆", 60, false)]);
vOk("示例数据", yx.SAMPLE_TASKS);
vOk("分钟数边界 1", [T("a", "x", 1, false)]);
vOk("分钟数边界 10080", [T("a", "x", 10080, true)]);
vOk("标题边界 1 字", [T("a", "x", 10, false)]);
vOk("标题边界 120 字", [T("a", "字".repeat(120), 10, false)]);
vOk("中文标题计数正确", [T("a", "研学计划测试", 30, true)]);
vOk("1000 项上限", Array.from({length:1000}, (_,i)=>T("i"+i,"t"+i,30,false)));

console.log("\n[2] 非法结构");
vBad("根节点非数组", {});
vBad("根节点为字符串", "abc");
vBad("根节点为 null", null);
vBad("超过 1000 项", Array.from({length:1001}, (_,i)=>T("i"+i,"t"+i,30,false)));
vBad("元素非对象", [123]);
vBad("元素为 null", [null]);
vBad("元素为数组", [[]]);
vBad("分钟数 0", [T("a","x",0,false)]);
vBad("分钟数 10081", [T("a","x",10081,false)]);
vBad("分钟数为小数", [T("a","x",1.5,false)]);
vBad("分钟数为字符串", [T("a","x","60",false)]);
vBad("分钟数为 NaN", [T("a","x",NaN,false)]);
vBad("分钟数为 Infinity", [T("a","x",Infinity,false)]);
vBad("标题为空字符串", [T("a","",10,false)]);
vBad("标题仅含空白", [T("a"," \t\n ",10,false)]);
vOk("标题首尾空白不计入长度", [T("a","  " + "字".repeat(120) + "  ",10,false)]);
vBad("标题 121 字", [T("a","字".repeat(121),10,false)]);
vBad("标题非字符串", [T("a",123,10,false)]);
vBad("done 非布尔(字符串)", [T("a","x",10,"true")]);
vBad("done 非布尔(数字)", [T("a","x",10,1)]);
vBad("ID 重复", [T("a","x",10,false), T("a","y",20,true)]);
vBad("ID 为空字符串", [T("","x",10,false)]);
vBad("ID 非字符串", [T(123,"x",10,false)]);
vBad("存在额外字段", [{ id:"a", title:"x", minutes:10, done:false, extra:1 }]);
vBad("缺少 done 字段", [{ id:"a", title:"x", minutes:10 }]);
vBad("缺少 minutes 字段", [{ id:"a", title:"x", done:false }]);
vBad("缺少 title 字段", [{ id:"a", minutes:10, done:false }]);
vBad("缺少 id 字段", [{ title:"x", minutes:10, done:false }]);

console.log("\n[3] 进度计算");
(function(){
  const p1 = yx.computeProgress([T("a","x",60,false), T("b","y",40,true)]);
  ok("部分完成 40/100=0.4", p1.done===40 && p1.total===100 && Math.abs(p1.pct-0.4)<1e-9);
  const p2 = yx.computeProgress([T("a","x",60,true), T("b","y",40,true)]);
  ok("全部完成 100%", p2.pct===1);
  const p3 = yx.computeProgress([]);
  ok("空计划 0%", p3.done===0 && p3.total===0 && p3.pct===0);
  const p4 = yx.computeProgress([T("a","x",60,false)]);
  ok("有任务但未完成 0%", p4.total===60 && p4.done===0 && p4.pct===0);
  const p5 = yx.computeProgress(yx.SAMPLE_TASKS);
  ok("示例进度 120/420", p5.done===120 && p5.total===420);
})();

console.log("\n[4] 工具函数");
ok("charLen 中文=4", yx.charLen("研学计划")===4);
ok("charLen emoji=1", yx.charLen("😀")===1);
ok("charLen 混合=5", yx.charLen("a研学b😀")===5);
ok("isSafeInt(60)", yx.isSafeInt(60)===true);
ok("isSafeInt(1.5)=false", yx.isSafeInt(1.5)===false);
ok("isSafeInt('60')=false", yx.isSafeInt("60")===false);
ok("isSafeInt(2**53)=false", yx.isSafeInt(Math.pow(2,53))===false);
ok("genId 唯一性", yx.genId() !== yx.genId());

console.log("\n[5] 导入整体校验语义（失败应保留原计划）");
(function(){
  const original = [T("keep","保留项",30,false)];
  const badImport = [T("a","x",10,false), { id:"a", title:"重复", minutes:5, done:false }];
  const r = yx.validateTaskArray(badImport);
  ok("含重复ID的导入被整体拒绝", r.ok===false);
  ok("原计划不受影响（语义说明）", yx.validateTaskArray(original).ok===true);
})();

console.log("\n==============================");
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
console.log("==============================");
process.exit(fail === 0 ? 0 : 1);
