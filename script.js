// 
// CONFIGURAÇÃO FIREBASE
// 
firebase.initializeApp({
 apiKey: "AIzaSyCUnobF2AqI_5WI_VerwaT_CGiKi2CFQE8",
 authDomain: "de-casa-para-casa-24392.firebaseapp.com",
 projectId: "de-casa-para-casa-24392",
 messagingSenderId: "817939442955",
 appId: "1:817939442955:web:c82b2176a3ee24e5f4060e"
});

const auth = firebase.auth();
const db = firebase.firestore();

// 
// CONFIGURAÇÃO SUPABASE STORAGE
// ⚠️  Substitui pelos teus valores do painel Supabase → Settings → API
// 
const SUPABASE_URL = "https://jbyfjbpmhjbbxlwkxfus.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieWZqYnBtaGpiYnhsd2t4ZnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTY3MzAsImV4cCI6MjA5MzQ5MjczMH0.YSaYl4pmJnnikcBB3Ka9udxecFDf70ImKr7czYEruwk";
const SUPABASE_BUCKET = "Casas";

// Supabase configurado — bucket: Casas

// Helper: upload de um ficheiro Blob/File para o Supabase Storage
async function uploadToSupabase(file, path) {
 const url = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`;
 const blob = (file instanceof Blob && file.type)
  ? file
  : new Blob([file], { type: 'image/jpeg' });
 const contentType = blob.type || 'image/jpeg';
 const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
 console.log(`📤 A enviar: ${path} (${sizeMB}MB, ${contentType})`);
 // Verificar tamanho — Supabase free tier tem limite de 50MB por ficheiro
 if(blob.size > 50 * 1024 * 1024) throw new Error(`Ficheiro demasiado grande (${sizeMB}MB). Máximo: 50MB`);
 let res;
 try {
  // Timeout de 120 segundos para vídeos grandes
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  res = await fetch(url, {
   method: "POST",
   headers: {
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": contentType,
    "x-upsert": "true"
   },
   body: blob,
   signal: controller.signal
  });
  clearTimeout(timer);
 } catch(netErr) {
  if(netErr.name === 'AbortError') throw new Error(`Upload cancelado por timeout (ficheiro muito grande?)`);
  throw new Error(`Erro de rede: ${netErr.message}`);
 }
 if (!res.ok) {
  let msg = `HTTP ${res.status}`;
  try { const j = await res.json(); msg = j.message || j.error || msg; } catch(_){}
  console.error(`❌ Upload falhou: ${msg}`);
  throw new Error(`Supabase (${res.status}): ${msg}`);
 }
 const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
 console.log(`✅ Upload OK: ${publicUrl}`);
 return publicUrl;
}

// Helper: apagar ficheiro do Supabase Storage pelo path
async function deleteFromSupabase(path) {
 if(!path||typeof path!=='string'||path.trim()==='')return; // BUG9: guard null/vazio
 const url = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${encodeURIComponent(path).replace(/%2F/g,'/')}`;
 try{
  await fetch(url, {
   method: "DELETE",
   headers: {
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "apikey": SUPABASE_ANON_KEY
   }
  });
 }catch(e){ console.warn('deleteFromSupabase silenciado:',e); }
}

// Extrai o path relativo de uma URL pública Supabase
// Ex: "https://...supabase.co/storage/v1/object/public/casas/houses/abc.jpg" → "houses/abc.jpg"
function supabasePathFromUrl(publicUrl) {
 const marker = `/object/public/${SUPABASE_BUCKET}/`;
 const idx = publicUrl.indexOf(marker);
 return idx !== -1 ? publicUrl.slice(idx + marker.length) : null;
}

let currentUser = null;
let allHouses = [];
let pendingModal = null;
let editingHouseId = null;
// Mapa global: houseId → array de URLs de media (evita JSON inline em onclick)
const _mediaMap = {};

// Placeholder SVG para imagens que falham — definido como função para evitar
// problemas de aspas em atributos HTML inline
function _imgError(el){
 el.onerror=null; // evitar loop
 el.src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
}

// FIX Bug#13 — flag para ignorar onAuthStateChanged durante registo/resend
let _suppressAuthChange = false;

// DARK MODE
// FIX Bug#1 — verificação de null em modeBtn
const modeBtn = document.getElementById('toggleMode');
if(modeBtn){
 const savedTheme=localStorage.getItem('dcpc_theme');
 if(savedTheme==='dark'){
  document.body.classList.add('dark');
  modeBtn.textContent='Claro'; // escuro ativo → botão oferece "Claro"
 } else {
  modeBtn.textContent='Escuro'; // BUG10: claro ativo → botão oferece "Escuro"
 }
 modeBtn.onclick=()=>{
  document.body.classList.toggle('dark');
  const d=document.body.classList.contains('dark');
  modeBtn.textContent=d?'Claro':'Escuro';
  localStorage.setItem('dcpc_theme',d?'dark':'light');
 };
}

// TOAST
function toast(msg,type='info'){
 const el=document.createElement('div');
 el.className=`toast ${type}`;
 el.textContent=msg;
 document.getElementById('toast-container').appendChild(el);
 setTimeout(()=>el.remove(),3300);
}

// MODAL
function showModal(title,msg,label,cb,danger=true){
 document.getElementById('modalTitle').textContent=title;
 document.getElementById('modalMsg').textContent=msg;
 const btn=document.getElementById('modalConfirmBtn');
 btn.textContent=label;btn.className=danger?'btn-danger':'btn-success';
 pendingModal=cb;
 document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal(){document.getElementById('modalOverlay').classList.add('hidden');pendingModal=null;}
document.getElementById('modalConfirmBtn').onclick=()=>{if(pendingModal)pendingModal();closeModal();};
document.getElementById('modalOverlay').onclick=e=>{if(e.target===e.currentTarget)closeModal();};

// PAGES
function showPage(id){
 // BUG11: verificar permissão ANTES de alterar o DOM
 if(id==='rentPage'&&(!currentUser||!currentUser.isAdmin)){
  toast("Apenas administradores!","error");
  id='menuPage';
 }
 if(id==='adminPage'&&(!currentUser||!currentUser.isAdmin)){
  toast("Acesso negado!","error");
  id='menuPage';
 }
 document.querySelectorAll('.container').forEach(d=>d.classList.add('hidden'));
 const target=document.getElementById(id);
 if(!target){console.error('showPage: página não encontrada →',id);return;}
 target.classList.remove('hidden');
 window.scrollTo(0,0);
 if(id==='searchPage'){clearTimeout(_searchDebounce);renderHouses();} // BUG21
 if(id==='menuPage') {startSlideshow();updateMenu();}
 if(id==='adminPage') loadAdmin();
 if(id==='profilePage') loadProfile();
}

// FIX Bug#3 — goBack não usava o parâmetro page; mantido comportamento correto
function goBack(){
 showPage(currentUser?'menuPage':'startPage');
}
document.getElementById('supportBack').onclick=()=>goBack();

// MENU
function updateMenu(){
 const a=currentUser?.isAdmin;
 document.getElementById('btnRent').classList.toggle('hidden',!a);
 document.getElementById('btnAdmin').classList.toggle('hidden',!a);
 document.getElementById('menuAdminBadge').classList.toggle('hidden',!a);
 document.getElementById('menuAvatar').textContent=(currentUser?.name||'?')[0].toUpperCase();
 document.getElementById('menuUserName').textContent=currentUser?.name||'—';
 document.getElementById('menuUserEmail').textContent=currentUser?.email||'—';
 // FIX Bug#12 — atualizar visibilidade do botão logout ao atualizar menu
 _updateLogBtn();
}

// SLIDESHOW
const slides=["IMG/00.jpg","IMG/1.jpg","IMG/2.jpg","IMG/3.jpg","IMG/4.jpg","IMG/5.jpg"];
let si=0,st=null;
function renderDots(){
 document.getElementById('slideDots').innerHTML=
  slides.map((_,i)=>`<div class="dot ${i===si?'active':''}" onclick="goSlide(${i})"></div>`).join('');
}
function goSlide(i){
 si=i;const img=document.getElementById('imagem');
 img.style.opacity=0;
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 setTimeout(()=>{img.src=slides[si];img.onerror=()=>{img.onerror=null;img.src=ph;};img.style.opacity=1;},250);
 renderDots();
}
function startSlideshow(){
 clearInterval(st);
 si=0;
 const img=document.getElementById('imagem');
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 img.src=slides[0];img.onerror=()=>{img.onerror=null;img.src=ph;};
 renderDots();
 st=setInterval(()=>goSlide((si+1)%slides.length),3000);
}

// PASS STRENGTH
function checkPassStrength(v){
 const bar=document.getElementById('passBar');
 let s=0;
 if(v.length>=6)s++;if(v.length>=10)s++;
 if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
 bar.style.width=(s*20)+'%';
 bar.style.background=['#ccc','#c0392b','#e08c1a','#e0c01a','#1a7a4a','#1a7a4a'][s];
}

// AUTH ERRORS
function errMsg(e){
 const m={
  'auth/email-already-in-use':'Este email já está registado.',
  'auth/invalid-email':'Email inválido.',
  'auth/weak-password':'Password demasiado fraca (mínimo 6 caracteres).',
  'auth/user-not-found':'Utilizador não encontrado.',
  'auth/wrong-password':'Password incorreta.',
  'auth/invalid-credential':'Email ou password incorretos.',
  'auth/too-many-requests':'Demasiadas tentativas. Tenta mais tarde.',
 };
 return m[e.code]||e.message;
}

// REGISTER
document.getElementById('registerBtn').onclick=async()=>{
 const name=document.getElementById('rName').value.trim();
 const phone=document.getElementById('rPhone').value.trim();
 const email=document.getElementById('rEmail').value.trim();
 const pass=document.getElementById('rPass').value.trim();
 const pass2=document.getElementById('rPass2').value.trim();
 if(!name||!phone||!email||!pass||!pass2)return toast("Preencha todos os campos!","error");
 if(pass.length<6)return toast("Password: mínimo 6 caracteres!","error");
 if(pass!==pass2)return toast("As passwords não coincidem!","error");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return toast("Insere um email válido!","error");
 const fakedomains=['mailinator.com','tempmail.com','guerrillamail.com','10minutemail.com','yopmail.com','trashmail.com','fakeinbox.com','sharklasers.com','maildrop.cc','discard.email','getnada.com'];
 const domain=email.split('@')[1]?.toLowerCase();
 if(fakedomains.includes(domain))return toast("Este domínio de email não é permitido!","error");
 const btn=document.getElementById('registerBtn');
 btn.disabled=true;btn.textContent=" A criar conta...";
 try{
  const cred=await auth.createUserWithEmailAndPassword(email,pass);
  await cred.user.updateProfile({displayName:name});
  await db.collection('users').doc(cred.user.uid).set({
   nome:name,telefone:phone,email,administrador:false,
   criadoEm:firebase.firestore.FieldValue.serverTimestamp()
  });
  toast("Conta criada com sucesso! Bem-vindo(a) 🏠","success");
  // onAuthStateChanged dispara automaticamente e redireciona para o menu
 }catch(e){
  if(auth.currentUser)try{await auth.currentUser.delete();}catch(e2){}
  toast(errMsg(e),"error");
  btn.disabled=false;btn.textContent="Confirmar Cadastro";
 }
};

// LOGIN
document.getElementById('loginBtn').onclick=async()=>{
 const email=document.getElementById('lEmail').value.trim();
 const pass=document.getElementById('lPass').value.trim();
 if(!email||!pass)return toast("Preencha email e password!","error");
 const btn=document.getElementById('loginBtn');
 btn.disabled=true;btn.textContent=" A entrar...";
 try{
  await auth.signInWithEmailAndPassword(email,pass);
  // onAuthStateChanged trata o redirect para o menu
  btn.disabled=false;btn.textContent="Entrar";
 }catch(e){
  toast(errMsg(e),"error");
  btn.disabled=false;btn.textContent="Entrar";
 }
};

// Verificação de email removida — utilizadores entram directamente após registo

// RECOVER
let lastRecoverEmail='', resendTimer=null;

document.getElementById('recoverBtn').onclick=async()=>{
 const email=document.getElementById('recEmail').value.trim();
 if(!email)return toast("Insere o teu email!","error");
 const btn=document.getElementById('recoverBtn');
 btn.disabled=true;btn.textContent=" A enviar...";
 try{
  await auth.sendPasswordResetEmail(email);
  lastRecoverEmail=email;
  document.getElementById('recoverStep1').classList.add('hidden');
  document.getElementById('recoverStep2').classList.remove('hidden');
  document.getElementById('recEmailSent').textContent=email;
  startResendCooldown();
 }catch(e){
  if(e.code==='auth/user-not-found'||e.code==='auth/invalid-credential'){
   toast("Este email não está registado!","error");
  }else{toast(errMsg(e),"error");}
 }finally{btn.disabled=false;btn.textContent=" Enviar Link de Recuperação";}
};

async function resendRecovery(){
 if(!lastRecoverEmail)return;
 const btn=document.getElementById('resendRecoverBtn');
 if(!btn)return; // BUG24: guard null
 btn.disabled=true;btn.textContent=" A reenviar...";
 try{
  await auth.sendPasswordResetEmail(lastRecoverEmail);
  toast("Email reenviado! Verifica o spam ","success");
  startResendCooldown();
 }catch(e){toast(errMsg(e)||"Erro ao reenviar.","error");}
 finally{btn.disabled=false;btn.textContent=" Reenviar Email";}
}

function startResendCooldown(){
 let secs=60;
 const el=document.getElementById('resendCooldown');
 const btn=document.getElementById('resendRecoverBtn');
 if(!el||!btn)return; // BUG25: guard null
 clearInterval(resendTimer); // BUG25: limpar ANTES de desabilitar e mostrar texto
 btn.disabled=true;el.style.display='block';
 el.textContent=`Podes reenviar em ${secs}s`;
 resendTimer=setInterval(()=>{
  secs--;el.textContent=`Podes reenviar em ${secs}s`;
  if(secs<=0){clearInterval(resendTimer);btn.disabled=false;el.style.display='none';}
 },1000);
}

// LOGOUT
// FIX Bug#11 — mantida apenas uma implementação centralizada de logout
function logout(){
 showModal('Sair','Tem a certeza que quer sair?','Sair',async()=>{
  try{
   await auth.signOut();
   toast("Sessão encerrada.","info");
  }catch(e){ // BUG22: tratar falha no signOut
   toast("Erro ao sair: "+e.message,"error");
  }
 });
}

// AUTH STATE
function hideLoader(){
 const ls=document.getElementById('loadingScreen');
 if(!ls)return;
 ls.style.opacity='0';
 setTimeout(()=>ls.style.display='none',400);
}

// FIX Bug#14 — setTimeout de segurança fora do callback, chamado uma única vez
setTimeout(hideLoader, 8000);

auth.onAuthStateChanged(async user=>{
 if(_suppressAuthChange)return;
 // BUG18: restaurar sempre o botão login antes de navegar
 const lBtn=document.getElementById('loginBtn');
 if(lBtn){lBtn.disabled=false;lBtn.textContent='Entrar';}
 if(user){
  try{
   const doc=await db.collection('users').doc(user.uid).get();
   const data=doc.exists?doc.data():{};
   currentUser={uid:user.uid,email:user.email,name:data.nome||user.displayName||'Utilizador',phone:data.telefone||'',isAdmin:data.administrador||false};
  }catch(e){
   currentUser={uid:user.uid,email:user.email,name:user.displayName||'Utilizador',phone:'',isAdmin:false};
  }
  hideLoader();
  showPage('menuPage');
 }else{
  currentUser=null;
  hideLoader();
  showPage('startPage');
 }
 _updateLogBtn();
});

// GOOGLE AUTH
async function loginWithGoogle(){
 const provider=new firebase.auth.GoogleAuthProvider();
 provider.setCustomParameters({prompt:'select_account'});
 try{
  const result=await auth.signInWithPopup(provider);
  const user=result.user;
  // BUG23: proteger escrita Firestore com try interno para não bloquear login
  try{
   const doc=await db.collection('users').doc(user.uid).get();
   if(!doc.exists){
    await db.collection('users').doc(user.uid).set({
     nome:user.displayName||'Utilizador',telefone:'',email:user.email,administrador:false,
     criadoEm:firebase.firestore.FieldValue.serverTimestamp()
    });
   }
  }catch(dbErr){ console.warn('Erro ao criar perfil Google:',dbErr); }
  toast("Bem-vindo(a), "+(user.displayName||'')+"! ","success");
 }catch(e){
  if(e.code==='auth/popup-blocked'){
   toast("Popup bloqueado pelo browser. Permite popups para este site.","error");
  }else if(e.code!=='auth/popup-closed-by-user'){
   toast(errMsg(e),"error");
  }
 }
}

// PROFILE
function loadProfile(){
 if(!currentUser)return;
 document.getElementById('pName').value=currentUser.name;
 document.getElementById('pPhone').value=currentUser.phone;
 document.getElementById('pEmail').value=currentUser.email;
 document.getElementById('profileAvatar').textContent=(currentUser.name||'?')[0].toUpperCase(); // BUG26
 document.getElementById('pPassNew').value='';
}

document.getElementById('saveProfileBtn').onclick=async()=>{
 const name=document.getElementById('pName').value.trim();
 const phone=document.getElementById('pPhone').value.trim();
 const passNew=document.getElementById('pPassNew').value;
 if(!name)return toast("O nome não pode estar vazio!","error");
 const btn=document.getElementById('saveProfileBtn');
 btn.disabled=true;btn.textContent=" A guardar...";
 try{
  await db.collection('users').doc(currentUser.uid).update({name,phone});
  await auth.currentUser.updateProfile({displayName:name});
  if(passNew){
   // BUG19: lançar erro em vez de return+reset manual para que o finally trate o botão
   if(passNew.length<6) throw new Error('Password: mínimo 6 caracteres!');
   await auth.currentUser.updatePassword(passNew);
  }
  currentUser.name=name;currentUser.phone=phone;
  toast("Perfil atualizado!","success");
  updateMenu();
 }catch(e){
  // BUG20: mensagem amigável para erro de reautenticação
  if(e.code==='auth/requires-recent-login'){
   toast("Por segurança, faz logout e login novamente antes de alterar a password.","error");
  }else{
   toast(e.message||"Erro ao guardar.","error");
  }
 }
 finally{btn.disabled=false;btn.textContent="Guardar Alterações";}
};

// HOUSES
// BUG12: função chamada pelo back-btn do rentPage — limpa estado antes de sair
function cancelRent(){
 editingHouseId=null;
 document.getElementById('editHouseId').value='';
 document.getElementById('uploadProgress').style.display='none';
 showPage('menuPage');
}

function startNewHouse(){
 editingHouseId=null;
 document.getElementById('editHouseId').value='';
 document.getElementById('rentPageTitle').textContent='Arrendar Casa';
 ['title','zone','rooms','living','kitchen','bathrooms','price','ownerContact','desc'].forEach(id=>document.getElementById(id).value='');
 document.getElementById('electricity').value='false';
 document.getElementById('yard').value='false';
 document.getElementById('houseStatus').value='disponivel';
 document.getElementById('photos').value='';
 showPage('rentPage');
}

function editHouse(id){
 if(!currentUser?.isAdmin)return;
 const h=allHouses.find(h=>h.id===id);if(!h)return;
 editingHouseId=id;
 document.getElementById('editHouseId').value=id;
 document.getElementById('rentPageTitle').textContent='Editar Casa';
 document.getElementById('title').value=h.title||'';
 document.getElementById('zone').value=h.zone||'';
 document.getElementById('rooms').value=h.rooms||'';
 document.getElementById('living').value=h.living||'';
 document.getElementById('kitchen').value=h.kitchen||'';
 document.getElementById('bathrooms').value=h.bathrooms||'';
 document.getElementById('price').value=h.price||'';
 document.getElementById('ownerContact').value=h.ownerContact||'';
 document.getElementById('desc').value=h.desc||'';
 document.getElementById('electricity').value=String(h.electricity);
 document.getElementById('yard').value=String(h.yard);
 document.getElementById('houseStatus').value=h.status||'disponivel';
 showPage('rentPage');
}

// Comprimir imagem e devolver Blob para upload eficiente ao Supabase
function compressImgToBlob(file,maxW,q){
 return new Promise((resolve,reject)=>{
  const rd=new FileReader();
  rd.onerror=()=>reject(new Error('Falha ao ler ficheiro'));
  rd.onload=e=>{
   const img=new Image();
   img.onerror=()=>reject(new Error('Falha ao carregar imagem'));
   img.onload=()=>{
    const c=document.createElement('canvas');
    let w=img.width,h=img.height;
    if(w>maxW){h=h*maxW/w;w=maxW;}
    c.width=w;c.height=h;
    c.getContext('2d').drawImage(img,0,0,w,h);
    c.toBlob(blob=>{
     if(blob){resolve(blob);}
     else{
      // BUG13: fallback Safari — canvas.toBlob retornou null; usar dataURL como Blob
      try{
       const dataUrl=c.toDataURL('image/jpeg',q);
       const arr=dataUrl.split(',');
       const bstr=atob(arr[1]);
       let n=bstr.length;
       const u8=new Uint8Array(n);
       while(n--)u8[n]=bstr.charCodeAt(n);
       resolve(new Blob([u8],{type:'image/jpeg'}));
      }catch(fe){reject(new Error('Falha ao comprimir imagem: '+fe.message));}
     }
    },'image/jpeg',q);
   };
   img.src=e.target.result;
  };
  rd.readAsDataURL(file);
 });
}




document.getElementById('saveHouse').onclick=async()=>{
 if(!currentUser?.isAdmin)return toast("Apenas administradores!","error");
 const title=document.getElementById('title').value.trim();
 const price=document.getElementById('price').value.trim();
 if(!title||!price)return toast("Título e preço são obrigatórios!","error");
 const zone=document.getElementById('zone').value.trim();
 const status=document.getElementById('houseStatus').value;
 const rooms=Number(document.getElementById('rooms').value)||0;
 const living=Number(document.getElementById('living').value)||0;
 const kitchen=Number(document.getElementById('kitchen').value)||0;
 const bathrooms=Number(document.getElementById('bathrooms').value)||0;
 const electricity=document.getElementById('electricity').value==="true";
 const yard=document.getElementById('yard').value==="true";
 const ownerContact=document.getElementById('ownerContact').value.trim();
 const desc=document.getElementById('desc').value.trim();
 const files=[...document.getElementById('photos').files].slice(0,50);
 const btn=document.getElementById('saveHouse');
 btn.disabled=true;btn.textContent=" A guardar...";
 try{
  const prog=document.getElementById('uploadProgress');
  let photos=[];
  if(files.length>0){
   prog.style.display='block';
   // Gerar ID único para esta casa (usado no path do Supabase)
   const houseFolder='houses/'+(Date.now())+'_'+(Math.random().toString(36).slice(2,8));
   for(let i=0;i<files.length;i++){
    const file=files[i];
    const isVid=file.type.startsWith('video/');
    if(isVid){
     // Vídeos: upload direto sem compressão
     prog.textContent=`A enviar vídeo ${i+1} de ${files.length}...`;
     const ext=file.name.split('.').pop()||'mp4';
     const path=`${houseFolder}/vid_${i}.${ext}`;
     const url=await uploadToSupabase(file,path);
     photos.push(url);
    }else{
     // Imagens: comprimir primeiro, depois enviar ao Supabase
     prog.textContent=`A enviar foto ${i+1} de ${files.length}...`;
     const blob=await compressImgToBlob(file,800,0.75);
     const path=`${houseFolder}/img_${i}.jpg`;
     const url=await uploadToSupabase(blob,path);
     photos.push(url);
    }
   }
   prog.style.display='none';
  }
  const editId=document.getElementById('editHouseId').value;
  const data={title,zone,status,rooms,living,kitchen,bathrooms,electricity,yard,price,ownerContact,desc};
  if(editId){
   const existingPhotos=allHouses.find(h=>h.id===editId)?.photos||[];
   if(photos.length===0){
    // Sem novas fotos: manter existentes
    photos=existingPhotos;
   }else{
    // Com novas fotos: apagar as antigas do Supabase
    for(const url of existingPhotos){
     const p=supabasePathFromUrl(url);
     if(p) await deleteFromSupabase(p).catch(()=>{});
    }
   }
   data.photos=photos;
   await db.collection('houses').doc(editId).update({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
   toast("Casa atualizada!","success");
  }else{
   data.photos=photos;
   data.createdBy=currentUser.uid;
   data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
   await db.collection('houses').add(data);
   toast("Casa cadastrada!","success");
  }
  showPage('menuPage');
 }catch(e){
  const msg=e.message||'Erro desconhecido';
  toast("❌ "+msg,"error");
  // Mostrar erro também no progresso para ser visível
  const prog=document.getElementById('uploadProgress');
  if(prog){prog.style.display='block';prog.textContent='ERRO: '+msg;}
 }
 finally{
  btn.disabled=false;btn.textContent=" Guardar Casa";
  // BUG14: garantir que o progresso é sempre limpo ao terminar (sucesso ou erro)
  const progF=document.getElementById('uploadProgress');
  if(progF&&progF.textContent&&!progF.textContent.startsWith('ERRO'))progF.style.display='none';
 }
};

// RENDER HOUSES
let filterModeActive="todos";
function setFilter(mode,el){
 filterModeActive=mode;
 document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
 el.classList.add('active');
 renderHouses();
}
function toggleAdvFilter(el){
 document.getElementById('advancedFilter').classList.toggle('open');
 el.classList.toggle('active');
}

// FIX Bug#9 — helper para sanitizar texto antes de inserir no innerHTML
function escapeHtml(str){
 if(!str)return '';
 return String(str)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#39;');
}

async function renderHouses(){
 const list=document.getElementById('houseList');
 list.innerHTML='<div class="spinner"></div>';
 try{
  const snap=await db.collection('houses').orderBy('createdAt','desc').get();
  allHouses=snap.docs.map(d=>({id:d.id,...d.data()}));
 }catch(e){
  list.innerHTML='<div class="empty-state"><div class="empty-icon"></div><p>Erro ao carregar casas.<br>Verifica a tua ligação.</p></div>';
  return;
 }
 const search=(document.getElementById('searchInput')?.value||'').toLowerCase();
 const maxPrice=parseFloat(document.getElementById('filterMaxPrice')?.value)||Infinity;
 const minRooms=parseInt(document.getElementById('filterMinRooms')?.value)||0;
 let houses=allHouses.filter(h=>{
  const ms=(h.title||'').toLowerCase().includes(search)||(h.zone||'').toLowerCase().includes(search)||String(h.price).includes(search);
  const mf=filterModeActive==='todos'?true:filterModeActive==='disponivel'?(!h.status||h.status==='disponivel'):filterModeActive==='quintal'?h.yard:filterModeActive==='energia'?h.electricity:true;
  return ms&&mf&&parseFloat(h.price)<=maxPrice&&parseInt(h.rooms||0)>=minRooms;
 });
 list.innerHTML='';
 if(!houses.length){
  list.innerHTML='<div class="empty-state"><div class="empty-icon"></div><p>Nenhuma casa encontrada.</p></div>';
  return;
 }
 const sl={disponivel:'Disponível',reservada:'Reservada',arrendada:'Arrendada'};
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 houses.forEach(h=>{
  const div=document.createElement('div');div.className='house-card';
  const photos=h.photos&&h.photos.length?h.photos:[];
  _mediaMap[h.id]=photos; // guardar para openLightboxById
  const sc=h.status||'disponivel';
  const hj=JSON.stringify({id:h.id,title:h.title||'',ownerContact:h.ownerContact||'',zone:h.zone||'',price:h.price||0,rooms:h.rooms||0,living:h.living||0,kitchen:h.kitchen||0,bathrooms:h.bathrooms||0,electricity:h.electricity||false,yard:h.yard||false,desc:h.desc||'',status:h.status||'disponivel'}).replace(/'/g,'&#39;');
  // FIX Bug#9 — sanitizar campos de texto antes de injetar no innerHTML
  // FIX Bug#16 — onerror com null-guard para evitar loop infinito
  const safeTitle=escapeHtml(h.title);
  const safeZone=escapeHtml(h.zone);
  const safeDesc=h.desc?escapeHtml(h.desc.length>100?h.desc.slice(0,100)+'…':h.desc):'';
  div.innerHTML=`
  <div class="card-gallery" id="g-${h.id}">
<img src="${photos[0]||ph}" alt="foto" data-idx="0" onerror="_imgError(this)" style="cursor:zoom-in;width:100%;height:190px;object-fit:cover;display:block;" onclick="openLightboxById('${h.id}',0)">
  ${photos.length>1?`<button class="gallery-btn gallery-prev" onclick="gNav('${h.id}',-1)">‹</button><button class="gallery-btn gallery-next" onclick="gNav('${h.id}',1)">›</button><div class="gallery-count"><span id="gc-${h.id}">1</span>/${photos.length}</div>`:''}
  <div class="status-badge ${sc}">${sl[sc]||'Disponível'}</div>
</div>
<div class="card-body">
<div class="card-title">${safeTitle}</div>
  ${h.zone?`<div class="card-zone"> ${safeZone}</div>`:''}
  <div class="card-features">
  ${h.rooms>0?`<span class="feature-tag">Quarto: ${h.rooms}</span>`:''}
  ${h.living>0?`<span class="feature-tag">Sala: ${h.living}</span>`:''}
  ${h.kitchen>0?`<span class="feature-tag">Cozinha: ${h.kitchen}</span>`:''}
  ${h.bathrooms>0?`<span class="feature-tag">WC: ${h.bathrooms}</span>`:''}
  ${h.electricity?`<span class="feature-tag">Com Energia</span>`:'<span class="feature-tag">Sem Energia</span>'}
  ${h.yard?`<span class="feature-tag">Com Quintal</span>`:'<span class="feature-tag">Sem Quintal</span>'}
  </div>
<div class="card-price">${Number(h.price).toLocaleString('pt-PT')} Kz<small>/mês</small></div>
  ${h.desc?`<div class="card-desc">${safeDesc}</div>`:''}
  <div class="card-actions"><button class="btn-success" onclick='showContact(${hj})'> Contactar</button></div>
</div>
  ${currentUser?.isAdmin?`<div class="card-admin-actions"><button class="btn-secondary" onclick="editHouse('${h.id}')"> Editar</button><button class="btn-danger" onclick="delHouse('${h.id}')"> Apagar</button></div>`:''}`;
  list.appendChild(div);
 });
}

function showContact(h){
 const info=document.getElementById('contactInfo');
 const sl={disponivel:'Disponível',arrendada:'Arrendada'};
 const statusColor={disponivel:'#1a7a4a',arrendada:'#c0392b'};
 const sc=h.status||'disponivel';

 // Formatar número para WhatsApp (remover espaços e garantir prefixo 244)
 const rawPhone=(h.ownerContact||'').replace(/\s+/g,'');
 const waNumber=rawPhone.startsWith('+')?rawPhone.slice(1):rawPhone.startsWith('0')?'244'+rawPhone.slice(1):rawPhone.startsWith('244')?rawPhone:'244'+rawPhone;
 const waMsg=encodeURIComponent('Olá! Vi a casa "'+h.title+'" no De Casa para Casa e tenho interesse. Pode dar mais informações?');
 const waLink='https://wa.me/'+waNumber+'?text='+waMsg;
 document.getElementById('contactWhatsApp').href=waLink;

 info.innerHTML=`
  <!-- Badge de estado -->
  <div style="display:inline-block;background:${statusColor[sc]}22;color:${statusColor[sc]};border:1px solid ${statusColor[sc]}44;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600;margin-bottom:14px;">${sl[sc]||'Disponível'}</div>

  <!-- Título -->
  <div style="font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--text);font-weight:700;margin-bottom:6px;">${escapeHtml(h.title)}</div>

  <!-- Zona -->
  ${h.zone?`<div style="color:var(--text2);font-size:13px;margin-bottom:14px;"> ${escapeHtml(h.zone)}</div>`:''}

  <!-- Preço -->
  <div style="font-size:1.3rem;font-weight:700;color:var(--accent2);margin-bottom:16px;">${Number(h.price).toLocaleString('pt-PT')} Kz<span style="font-size:13px;font-weight:400;">/mês</span></div>

  <!-- Características -->
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
    ${h.rooms>0?`<span style="background:var(--input-bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:12px;"> ${h.rooms} Quarto${h.rooms>1?'s':''}</span>`:''}
    ${h.living>0?`<span style="background:var(--input-bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:12px;"> ${h.living} Sala${h.living>1?'s':''}</span>`:''}
    ${h.kitchen>0?`<span style="background:var(--input-bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:12px;"> ${h.kitchen} Cozinha${h.kitchen>1?'s':''}</span>`:''}
    ${h.bathrooms>0?`<span style="background:var(--input-bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:12px;"> ${h.bathrooms} WC</span>`:''}
    <span style="background:var(--input-bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:12px;">${h.electricity?' Com Energia':' Sem Energia'}</span>
    <span style="background:var(--input-bg);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:12px;">${h.yard?' Com Quintal':' Sem Quintal'}</span>
  </div>

  <!-- Descrição -->
  ${h.desc?`<div style="background:var(--input-bg);border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text2);line-height:1.7;border:1px solid var(--border);">${escapeHtml(h.desc)}</div>`:''}

  <!-- Contacto -->
  <div style="background:var(--input-bg);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:4px;">
    <div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Contacto do Proprietário</div>
    <div style="font-size:16px;font-weight:600;color:var(--text);">${escapeHtml(h.ownerContact||'Não disponível')}</div>
  </div>
 `;

 document.getElementById('contactModal').classList.remove('hidden');
}

// FIX Bug#6 — gNav definida uma única vez, com suporte a vídeo integrado
// FIX Bug#15 — substituição de media feita via innerHTML do container, não outerHTML
function gNav(id,dir){
 const g=document.getElementById('g-'+id);
 if(!g)return;
 const media=g.querySelector('[data-photos]');
 if(!media)return;
 const photos=JSON.parse(media.dataset.photos||'[]');
 if(photos.length<=1)return;
 let idx=parseInt(media.dataset.idx||0)+dir;
 if(idx<0)idx=photos.length-1;if(idx>=photos.length)idx=0;

 const newSrc=photos[idx];
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";

 // Substituir o elemento media pelo novo, mantendo referência via ID do wrapper
 const mediaWrapper=document.createElement('div');
 mediaWrapper.innerHTML=renderMediaThumb(newSrc,photos,idx,id);
 const newEl=mediaWrapper.firstChild;

 media.style.opacity=0;
 setTimeout(()=>{
  if(media.parentNode){
   media.parentNode.replaceChild(newEl,media);
   // BUG17: forçar reflow e restaurar opacidade no novo elemento
   newEl.style.opacity=0;
   requestAnimationFrame(()=>{newEl.style.transition='opacity .3s';newEl.style.opacity=1;});
  }
 },200);

 const c=document.getElementById('gc-'+id);if(c)c.textContent=idx+1;
}

function delHouse(id){
 showModal('Apagar casa','Esta ação é irreversível. Confirmas?','Apagar',async()=>{
  try{
   // Apagar fotos do Supabase Storage antes de apagar o documento
   const house=allHouses.find(h=>h.id===id);
   if(house?.photos?.length){
    for(const url of house.photos){
     const path=supabasePathFromUrl(url);
     if(path) await deleteFromSupabase(path).catch(()=>{});
    }
   }
   await db.collection('houses').doc(id).delete();
   toast("Casa apagada.","success");
   renderHouses();
  }catch(e){
   toast("Erro ao apagar: "+e.message,"error");
  }
 });
}

// Bug#19 — debounce na pesquisa para evitar leituras excessivas ao Firestore
let _searchDebounce=null;
document.getElementById('searchInput').addEventListener('input',()=>{
 clearTimeout(_searchDebounce);
 _searchDebounce=setTimeout(()=>renderHouses(),350);
});

// ADMIN
async function loadAdmin(){
 if(!currentUser?.isAdmin){toast("Acesso negado!","error");showPage('menuPage');return;}
 // BUG27: mostrar spinner antes de cada carregamento (não apenas na primeira vez)
 const listEl=document.getElementById('userList');
 if(listEl)listEl.innerHTML='<div class="spinner"></div>';
 try{
  const [uSnap,hSnap]=await Promise.all([db.collection('users').get(),db.collection('houses').get()]);
  const users=uSnap.docs.map(d=>({uid:d.id,...d.data()}));
  const houses=hSnap.docs.map(d=>({id:d.id,...d.data()}));
  const avail=houses.filter(h=>!h.status||h.status==='disponivel').length;
  const rented=houses.filter(h=>h.status==='arrendada').length;
  document.getElementById('adminStats').innerHTML=`
  <div class="stat-card"><span class="stat-num">${users.length}</span><span class="stat-label">Utilizadores</span></div>
<div class="stat-card"><span class="stat-num">${houses.length}</span><span class="stat-label">Casas</span></div>
<div class="stat-card"><span class="stat-num">${avail}</span><span class="stat-label">Disponíveis</span></div>
<div class="stat-card"><span class="stat-num">${rented}</span><span class="stat-label">Arrendadas</span></div>`;
  const list=document.getElementById('userList');list.innerHTML='';
  users.forEach(u=>{
   const isSelf=u.uid===currentUser.uid;
   const item=document.createElement('div');item.className='user-item';
   item.innerHTML=`
   <div class="user-avatar" style="width:36px;height:36px;font-size:14px;flex-shrink:0;">${escapeHtml((u.name||'?')[0].toUpperCase())}</div>
<div class="user-item-info">
<strong>${escapeHtml(u.name||'—')} ${u.isAdmin?'<span class="admin-badge">ADMIN</span>':''} ${isSelf?'<span style="font-size:10px;color:var(--text2);">(você)</span>':''}</strong>
<span> ${escapeHtml(u.phone||'—')} · ${escapeHtml(u.email||'—')}</span>
</div>
<div class="user-item-actions">
   ${!isSelf?(u.isAdmin?`<button class="btn-danger btn-sm" onclick="setAdmin('${u.uid}',false)">- Admin</button>`:`<button class="btn-success btn-sm" onclick="setAdmin('${u.uid}',true)">+ Admin</button>`):''}
   ${!isSelf?`<button class="btn-secondary btn-sm" onclick="delUser('${u.uid}')">❌</button>`:''}
   </div>`;
   list.appendChild(item);
  });
 }catch(e){
  document.getElementById('userList').innerHTML='<p style="color:var(--danger);">Erro ao carregar utilizadores.</p>';
 }
}

async function setAdmin(uid,val){
 try{
  await db.collection('users').doc(uid).update({isAdmin:val});
  toast(val?"Admin adicionado!":"Admin removido.","success");
  loadAdmin();
 }catch(e){
  toast("Erro ao alterar permissões: "+e.message,"error");
 }
}

// FIX Bug#10 — delUser agora também remove a conta Firebase Auth via Admin SDK
// Nota: a eliminação da conta Auth requer Firebase Admin SDK no backend.
// Aqui marcamos o utilizador como "deleted" no Firestore e removemos os dados;
// a eliminação final da conta Auth deve ser feita por uma Cloud Function.
function delUser(uid){
 showModal('Apagar utilizador','Esta ação é permanente. Confirmas?','Apagar',async()=>{
  try{
   await db.collection('users').doc(uid).delete();
   await db.collection('deletionQueue').doc(uid).set({uid, requestedAt: firebase.firestore.FieldValue.serverTimestamp()});
   toast("Utilizador apagado. A conta de acesso será removida em breve.","success");
   loadAdmin();
  }catch(e){
   toast("Erro ao apagar utilizador: "+e.message,"error");
  }
 });
}

// BUTTONS
document.getElementById('btnRegister').onclick=()=>showPage('registerPage');
document.getElementById('btnLogin').onclick=()=>showPage('loginPage');
document.getElementById('googleLoginBtn').onclick=()=>loginWithGoogle();
document.getElementById('googleRegisterBtn').onclick=()=>loginWithGoogle();

// FIX Bug#11 — botão de logout usa a função centralizada logout()
// FIX Bug#12 — _updateLogBtn é chamada em updateMenu() e onAuthStateChanged
const _logBtn=document.getElementById('logoutTopBtn');
if(_logBtn){
 _logBtn.onclick=()=>logout();
}
function _updateLogBtn(){
 if(_logBtn) _logBtn.classList.toggle('hidden',!currentUser);
}

// MEDIA THUMB
function isVideo(src){
 if(!src)return false;
 if(src.startsWith('data:video'))return true;
 // BUG28: remover query string antes de verificar extensão
 const cleanSrc=src.split('?')[0];
 return /\.(mp4|webm|ogg|mov)$/i.test(cleanSrc);
}

// FIX Bug#7 — template literals corrigidos (removido \$ → $)
function renderMediaThumb(src, allMedia, idx, houseId){
 if(isVideo(src)){
  // FIX-VIDEO: usar houseId em vez de JSON inline para evitar quebra de atributo HTML
  return `<div style="position:relative;width:100%;height:190px;background:#111;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="openLightboxById('${houseId}',${idx})" data-idx="${idx}" data-house-id="${houseId}"><video src="${src}" style="width:100%;height:190px;object-fit:cover;display:block;pointer-events:none;" muted playsinline preload="metadata"></video><div style="position:absolute;width:52px;height:52px;background:rgba(0,0,0,.6);border-radius:50%;display:flex;align-items:center;justify-content:center;"><svg viewBox='0 0 24 24' fill='white' width='26' height='26'><polygon points='5,3 19,12 5,21'/></svg></div></div>`;
 }
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 // BUG16: sanitizar aspas simples em data-photos para não quebrar o atributo HTML
 const ph2="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 // FIX-IMG: usar houseId em vez de JSON inline
 return `<img src="${src}" alt="foto" data-idx="${idx}" data-house-id="${houseId}" onerror="_imgError(this)" style="cursor:zoom-in;" onclick="openLightboxById('${houseId}',${idx})">`;
}

// LIGHTBOX
let _lbMedia=[], _lbIdx=0;

// openLightboxById: abre pelo ID da casa (evita JSON inline em onclick)
function openLightboxById(houseId, idx){
 const media=_mediaMap[houseId];
 if(!media||!media.length)return;
 openLightbox(media, idx||0);
}

function openLightbox(media, idx){
 if(!media||!media.length)return;
 _lbMedia=Array.isArray(media)?media:[media];
 _lbIdx=(idx||0);
 const lb=document.getElementById('lightbox');
 lb.style.display='flex';
 lb.style.flexDirection='column';
 lb.style.alignItems='center';
 lb.style.justifyContent='center';
 lbShow();
 lb.classList.add('open');
 document.body.style.overflow='hidden';
}

function closeLightbox(){
 const lb=document.getElementById('lightbox');
 lb.classList.remove('open');
 lb.style.display='none'; // FIX-LB: garantir que fecha mesmo sem CSS
 const v=document.getElementById('lbVid');
 if(v){v.pause(); v.src='';}
 document.body.style.overflow='';
}

// FIX Bug#17 — lbNav verifica array vazio antes de calcular índice
function lbNav(dir){
 if(!_lbMedia.length)return;
 _lbIdx=(_lbIdx+dir+_lbMedia.length)%_lbMedia.length;
 lbShow();
}

function lbShow(){
 const src=_lbMedia[_lbIdx];
 const img=document.getElementById('lbImg');
 const vid=document.getElementById('lbVid');
 const ctr=document.getElementById('lbCounter');
 const prev=document.getElementById('lbPrev');
 const next=document.getElementById('lbNext');

 if(isVideo(src)){
  img.style.display='none';
  vid.removeAttribute('src'); // limpar antes
  vid.style.display='block';
  vid.style.maxWidth='96vw';
  vid.style.maxHeight='90vh';
  vid.setAttribute('controls','');
  vid.setAttribute('playsinline','');
  vid.src=src;
  vid.load();
  // autoplay após load (mobile pode bloquear mas controls ficam visíveis)
  const playPromise=vid.play();
  if(playPromise!==undefined) playPromise.catch(()=>{});
 }else{
  vid.style.display='none'; vid.pause(); vid.src='';
  img.style.display='block';
  img.onerror=()=>_imgError(img);
  img.src=src;
 }
 ctr.textContent=_lbMedia.length>1?(_lbIdx+1)+' / '+_lbMedia.length:'';
 prev.style.display=_lbMedia.length>1?'flex':'none';
 next.style.display=_lbMedia.length>1?'flex':'none';
}

// FIX Bug#17 — teclas de navegação só ativas quando lightbox está aberto
document.addEventListener('keydown',e=>{
 const isOpen=document.getElementById('lightbox')?.classList.contains('open');
 if(isOpen&&e.key==='Escape') closeLightbox();
 if(isOpen&&e.key==='ArrowLeft') lbNav(-1);
 if(isOpen&&e.key==='ArrowRight') lbNav(1);
});
