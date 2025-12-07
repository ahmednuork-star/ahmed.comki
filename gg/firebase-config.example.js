// firebase-config.example.js يجب استبدال firebaseConfig بالقيم الخاصة بك
if(typeof firebase === 'undefined'){alert('Firebase لم يُحمّل!');}
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const DEFAULT_MANAGER_CODE = "amkahmedamk6569";
const HQ_LOCATION_NAME = "مخيم قاقا";

let state = { user:null, role:'customer', cart:[] };

// ---------------- Auth ----------------
async function googleSignIn(){
  const provider = new firebase.auth.GoogleAuthProvider();
  try{ const res = await auth.signInWithPopup(provider); await postSignIn(res.user); } 
  catch(e){ alert(e.message);}
}
async function emailSignUp(){ const email=document.getElementById('emailInput').value; const pass=document.getElementById('passwordInput').value; try{ const res=await auth.createUserWithEmailAndPassword(email,pass); await postSignIn(res.user); } catch(e){ alert(e.message); }}
async function emailSignIn(){ const email=document.getElementById('emailInput').value; const pass=document.getElementById('passwordInput').value; try{ const res=await auth.signInWithEmailAndPassword(email,pass); await postSignIn(res.user); } catch(e){ alert(e.message); }}

async function loginWithCode(){
  const code = document.getElementById('codeInput').value.trim();
  if(!code) { alert('أدخل الشفرة'); return; }
  const cfgDoc = await db.collection('config').doc('app').get();
  let managerCode = DEFAULT_MANAGER_CODE;
  if(cfgDoc.exists && cfgDoc.data().managerCode) managerCode = cfgDoc.data().managerCode;
  if(code===managerCode){ state.role='manager'; showPanel('manager'); loadManagerData(); return; }
  const snap = await db.collection('employeeCodes').where('code','==',code).get();
  if(!snap.empty){ state.role='employee'; state.code=code; showPanel('employee'); loadEmployeeOrders(); return;}
  alert('الشفرة غير صحيحة');
}

async function postSignIn(user){
  state.user={uid:user.uid,email:user.email,name:user.displayName};
  const doc = await db.collection('users').doc(user.uid).get();
  if(doc.exists && doc.data().role){ state.role=doc.data().role; }
  if(state.role==='manager'){ showPanel('manager'); loadManagerData(); }
  else if(state.role==='employee'){ showPanel('employee'); loadEmployeeOrders(); }
  else if(state.role==='recruiter'){ showPanel('recruiter'); loadRecruiterOrders(); }
  else{ showPanel('store'); loadProducts(); }
}

function signOut(){ auth.signOut(); state.user=null; hideAllPanels(); document.getElementById('auth').classList.remove('hidden'); state.role='customer'; }

// ---------------- Panels ----------------
function hideAllPanels(){ ['managerPanel','employeePanel','recruiterPanel','storePanel'].forEach(id=>document.getElementById(id).classList.add('hidden')); }
function showPanel(name){ hideAllPanels(); document.getElementById(name+'Panel').classList.remove('hidden'); }

// ---------------- Manager ----------------
async function loadManagerData(){
  const ordersSnap = await db.collection('orders').get();
  const prodSnap = await db.collection('products').get();
  document.getElementById('statOrders').innerText=ordersSnap.size;
  let total=0; ordersSnap.forEach(d=>{const p=d.data().product;if(p&&p.price)total+=p.price;});
  document.getElementById('statSales').innerText=total;
  document.getElementById('statVisitors').innerText='—';
  const container=document.getElementById('managerProducts'); container.innerHTML='';
  prodSnap.forEach(doc=>{const p=doc.data(); container.innerHTML+=`<div class="product"><strong>${p.title}</strong> — ${p.price}<br/><img src="${p.imageUrl||''}" style="max-width:140px"/><button onclick="deleteProduct('${doc.id}')">حذف</button></div>`;});
  const codesSnap=await db.collection('employeeCodes').get();
  const codesList=document.getElementById('codesList'); codesList.innerHTML=''; codesSnap.forEach(s=>codesList.innerHTML+=`<div>${s.data().code}</div>`);
}

async function createProduct(){
  const title=document.getElementById('prodTitle').value;
  const price=Number(document.getElementById('prodPrice').value||0);
  const file=document.getElementById('prodImage').files[0];
  if(!title||!price||!file){alert('أكمل الحقول'); return;}
  const ref=storage.ref(`products/${Date.now()}_${file.name}`); const snap=await ref.put(file); const url=await snap.ref.getDownloadURL();
  await db.collection('products').add({title,price,imageUrl:url,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  alert('تم إضافة المنتج'); loadManagerData();
}

async function deleteProduct(id){ if(!confirm('هل تريد حذف المنتج؟')) return; await db.collection('products').doc(id).delete(); loadManagerData(); }
async function createEmployeeCode(){ const code=document.getElementById('newEmpCode').value.trim(); if(!code){alert('أدخل رمز');return;} await db.collection('employeeCodes').add({code,createdAt:firebase.firestore.FieldValue.serverTimestamp()}); alert('تم إنشاء الشفرة'); loadManagerData(); }

// ---------------- Products / Store ----------------
async function loadProducts(){ const snap=await db.collection('products').orderBy('createdAt','desc').get(); const container=document.getElementById('productsList'); container.innerHTML=''; snap.forEach(doc=>{const p=doc.data(); container.innerHTML+=`<div class="product card"><h4>${p.title}</h4><div><img src="${p.imageUrl||''}" /></div><p>السعر: ${p.price}</p><button onclick='addToCart("${doc.id}")'>أضف إلى السلة</button><button onclick='askAboutProduct("${doc.id}")'>سؤال عن المنتج</button></div>`;}); }
function addToCart(productId){ state.cart.push(productId); document.getElementById('cartCount').innerText=state.cart.length; alert('أضيف إلى السلة'); }
async function askAboutProduct(productId){ const chatCfg=await db.collection('config').doc('chat').get(); const name=(chatCfg.exists&&chatCfg.data().name)?chatCfg.data().name:'Ahmed Technology'; const doc=await db.collection('products').doc(productId).get(); const p=doc.data(); appendChat(`مرحبًا! معك ${name}. هذا المنتج "${p.title}". هل أنت متواجد حالياً في ${HQ_LOCATION_NAME}?`);}
function appendChat(text){ const box=document.getElementById('chatBox'); box.innerHTML+=`<div><strong>Ahmed Technology:</strong> ${text}</div>`; box.scrollTop=box.scrollHeight; }
async function sendChat(){ const txt=document.getElementById('chatInput').value.trim(); if(!txt)return; const box=document.getElementById('chatBox'); box.innerHTML+=`<div><strong>أنت:</strong> ${txt}</div>`; document.getElementById('chatInput').value=''; if(txt.includes('نعم')||txt.includes('موجود')){appendChat(`ممتاز — التوصيل داخل ${HQ_LOCATION_NAME} مجاني. هل تود تحويل الطلب للمدير؟`);} else if(txt.includes('حول للمدير')||txt.includes('تحويل')){appendChat('حسناً، سأحوّل طلبك الآن للمدير.'); await db.collection('orders').add({product:{title:'طلب عبر الشات'},status:'انتظار تحويل',createdAt:firebase.firestore.FieldValue.serverTimestamp()});} else{appendChat('تم فهم رسالتك، وسنوافيك بالمطلوب.');}}

// ---------------- Cart ----------------
function openCart(){ document.getElementById('cartModal').classList.remove('hidden'); renderCart(); }
function closeCart(){ document.getElementById('cartModal').classList.add('hidden'); }
async function renderCart(){ const items=document.getElementById('cartItems'); items.innerHTML=''; let total=0; for(const pid of state.cart){ const doc=await db.collection('products').doc(pid).get(); const p=doc.data(); items.innerHTML+=`<div>${p.title} — ${p.price}</div>`; total+=p.price;} document.getElementById('cartTotal').innerText=total;}
async function checkout(){ if(state.cart.length===0){alert('السلة فارغة'); return;} for(const pid of state.cart){ const doc=await db.collection('products').doc(pid).get(); const p=doc.data(); await db.collection('orders').add({product:p,customerUid:state.user?state.user.uid:null,status:'قيد المعالجة',createdAt:firebase.firestore.FieldValue.serverTimestamp()});} alert('تم إنشاء الطلبات'); state.cart=[]; document.getElementById('cartCount').innerText=0; closeCart();}

// ---------------- Employee ----------------
async function loadEmployeeOrders(){ const snap=await db.collection('orders').where('status','==','قيد المعالجة').get(); const container=document.getElementById('employeeOrders'); container.innerHTML=''; snap.forEach(doc=>{const d