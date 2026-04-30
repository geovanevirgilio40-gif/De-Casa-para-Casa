// 
// CONFIGURAÇÃO FIREBASE
// 
firebase.initializeApp({
 apiKey: "AIzaSyCUnobF2AqI_5WI_VerwaT_CGiKi2CFQE8",
 authDomain: "de-casa-para-casa-24392.firebaseapp.com",
 projectId: "de-casa-para-casa-24392",
 storageBucket: "de-casa-para-casa-24392.firebasestorage.app",
 messagingSenderId: "817939442955",
 appId: "1:817939442955:web:c82b2176a3ee24e5f4060e"
});

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let allHouses = [];
let pendingModal = null;
let editingHouseId = null;

// DARK MODE 
const modeBtn = document.getElementById('toggleMode');
if(localStorage.getItem('dcpc_theme')==='dark'){document.body.classList.add('dark');modeBtn.textContent='Claro';}
modeBtn.onclick=()=>{
 document.body.classList.toggle('dark');
 const d=document.body.classList.contains('dark');
 modeBtn.textContent=d?'Escuro':'Claro';
 localStorage.setItem('dcpc_theme',d?'dark':'light');
};

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
 document.querySelectorAll('.container').forEach(d=>d.classList.add('hidden'));
 document.getElementById(id).classList.remove('hidden');
 window.scrollTo(0,0);
 if(id==='searchPage') renderHouses();
 if(id==='menuPage') {startSlideshow();updateMenu();}
 if(id==='adminPage') loadAdmin();
 if(id==='profilePage')loadProfile();
 if(id==='rentPage'&&(!currentUser||!currentUser.isAdmin)){
 toast("Apenas administradores!","error");showPage('menuPage');return;
 }
}

function goBack(page){
 showPage(currentUser?'menuPage':'startPage');
}
document.getElementById('supportBack').onclick=()=>goBack('suporte');

// MENU 
function updateMenu(){
 const a=currentUser?.isAdmin;
 document.getElementById('btnRent').classList.toggle('hidden',!a);
 document.getElementById('btnAdmin').classList.toggle('hidden',!a);
 document.getElementById('menuAdminBadge').classList.toggle('hidden',!a);
 document.getElementById('menuAvatar').textContent=(currentUser?.name||'?')[0].toUpperCase();
 document.getElementById('menuUserName').textContent=currentUser?.name||'—';
 document.getElementById('menuUserEmail').textContent=currentUser?.email||'—';
}

// SLIDESHOW 
const slides=["img/00.jpg","img/1.jpg","img/2.jpg","img/3.jpg","img/4.jpg","img/5.jpg"];
let si=0,st=null;
function renderDots(){
 document.getElementById('slideDots').innerHTML=
 slides.map((_,i)=>`<div class="dot ${i===si?'active':''}" onclick="goSlide(${i})"></div>`).join('');
}
function goSlide(i){
 si=i;const img=document.getElementById('imagem');
 img.style.opacity=0;
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 setTimeout(()=>{img.src=slides[si];img.onerror=()=>img.src=ph;img.style.opacity=1;},250);
 renderDots();
}
function startSlideshow(){
 clearInterval(st);
 const img=document.getElementById('imagem');
 const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
 img.src=slides[0];img.onerror=()=>img.src=ph;
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
 if(!name||!phone||!email||!pass)return toast("Preencha todos os campos!","error");
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
 name,phone,email,isAdmin:false,
 createdAt:firebase.firestore.FieldValue.serverTimestamp()
 });
 await cred.user.sendEmailVerification();
 await auth.signOut();
 toast("Conta criada! Verifica o teu email antes de entrar 📧","success");
 showPage('loginPage');
 }catch(e){
 if(auth.currentUser)try{await auth.currentUser.delete();}catch(e2){}
 toast(errMsg(e),"error");
 }finally{btn.disabled=false;btn.textContent="Confirmar Cadastro";}
};

// ═══ LOGIN ═══
document.getElementById('loginBtn').onclick=async()=>{
 const email=document.getElementById('lEmail').value.trim();
 const pass=document.getElementById('lPass').value.trim();
 if(!email||!pass)return toast("Preencha email e password!","error");
 const btn=document.getElementById('loginBtn');
 btn.disabled=true;btn.textContent=" A entrar...";
 try{
 const cred=await auth.signInWithEmailAndPassword(email,pass);
 if(!cred.user.emailVerified){
 await auth.signOut();
 toast("Email não verificado! Verifica a tua caixa de correio ","error");
 document.getElementById('resendVerif').classList.remove('hidden');
 document.getElementById('resendVerif').dataset.email=email;
 document.getElementById('resendVerif').dataset.pass=pass;
 btn.disabled=false;btn.textContent="Entrar";
 return;
 }
 document.getElementById('resendVerif').classList.add('hidden');
 }catch(e){
 toast(errMsg(e),"error");
 btn.disabled=false;btn.textContent="Entrar";
 }
};

async function resendEmail(){
 const div=document.getElementById('resendVerif');
 const email=div.dataset.email, pass=div.dataset.pass;
 if(!email||!pass)return toast("Faz login primeiro.","error");
 try{
 const cred=await auth.signInWithEmailAndPassword(email,pass);
 await cred.user.sendEmailVerification();
 await auth.signOut();
 toast("Email reenviado! Verifica o spam também ","success");
 }catch(e){toast(errMsg(e),"error");}
}

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
 btn.disabled=true;btn.textContent=" A reenviar...";
 try{
 await auth.sendPasswordResetEmail(lastRecoverEmail);
 toast("Email reenviado! Verifica o spam ","success");
 startResendCooldown();
 }catch(e){toast("Erro ao reenviar.","error");}
 finally{btn.disabled=false;btn.textContent=" Reenviar Email";}
}

function startResendCooldown(){
 let secs=60;
 const el=document.getElementById('resendCooldown');
 const btn=document.getElementById('resendRecoverBtn');
 btn.disabled=true;el.style.display='block';
 clearInterval(resendTimer);
 resendTimer=setInterval(()=>{
 secs--;el.textContent=`Podes reenviar em ${secs}s`;
 if(secs<=0){clearInterval(resendTimer);btn.disabled=false;el.style.display='none';}
 },1000);
}

// ═══ LOGOUT ═══
function logout(){
 showModal('Sair','Tem a certeza que quer sair?','Sair',async()=>{
 await auth.signOut();
 toast("Sessão encerrada.","info");
 });
}

// AUTH STATE 
function hideLoader(){
 const ls=document.getElementById('loadingScreen');
 if(!ls)return;
 ls.style.opacity='0';
 setTimeout(()=>ls.style.display='none',400);
}

auth.onAuthStateChanged(async user=>{
 if(user){
 try{
 const doc=await db.collection('users').doc(user.uid).get();
 const data=doc.exists?doc.data():{};
 currentUser={uid:user.uid,email:user.email,name:data.name||user.displayName||'Utilizador',phone:data.phone||'',isAdmin:data.isAdmin||false};
 }catch(e){
 currentUser={uid:user.uid,email:user.email,name:user.displayName||'Utilizador',phone:'',isAdmin:false};
 }
 document.getElementById('loginBtn').disabled=false;
 document.getElementById('loginBtn').textContent="Entrar";
 hideLoader();
 showPage('menuPage');
 }else{
 currentUser=null;
 hideLoader();
 showPage('startPage');
 }
 // Safety timeout
 setTimeout(hideLoader, 8000);
});

// GOOGLE AUTH 
async function loginWithGoogle(){
 const provider=new firebase.auth.GoogleAuthProvider();
 provider.setCustomParameters({prompt:'select_account'});
 try{
 const result=await auth.signInWithPopup(provider);
 const user=result.user;
 const doc=await db.collection('users').doc(user.uid).get();
 if(!doc.exists){
 await db.collection('users').doc(user.uid).set({
 name:user.displayName||'Utilizador',phone:'',email:user.email,isAdmin:false,
 createdAt:firebase.firestore.FieldValue.serverTimestamp()
 });
 }
 toast("Bem-vindo(a), "+(user.displayName||'')+"! ","success");
 }catch(e){
 if(e.code!=='auth/popup-closed-by-user')toast(errMsg(e),"error");
 }
}

// PROFILE 
function loadProfile(){
 if(!currentUser)return;
 document.getElementById('pName').value=currentUser.name;
 document.getElementById('pPhone').value=currentUser.phone;
 document.getElementById('pEmail').value=currentUser.email;
 document.getElementById('profileAvatar').textContent=currentUser.name[0].toUpperCase();
 document.getElementById('pPassNew').value='';
}

document.getElementById('saveProfileBtn').onclick=async()=>{
 const name=document.getElementById('pName').value.trim();
 const phone=document.getElementById('pPhone').value.trim();
 const passNew=document.getElementById('pPassNew').value.trim();
 if(!name)return toast("O nome não pode estar vazio!","error");
 const btn=document.getElementById('saveProfileBtn');
 btn.disabled=true;btn.textContent=" A guardar...";
 try{
 await db.collection('users').doc(currentUser.uid).update({name,phone});
 await auth.currentUser.updateProfile({displayName:name});
 if(passNew){
 if(passNew.length<6){toast("Password: mínimo 6 caracteres!","error");return;}
 await auth.currentUser.updatePassword(passNew);
 }
 currentUser.name=name;currentUser.phone=phone;
 toast("Perfil atualizado!","success");
 updateMenu();
 }catch(e){toast(e.message||"Erro ao guardar.","error");}
 finally{btn.disabled=false;btn.textContent="Guardar Alterações";}
};

// ═══ HOUSES ═══
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

function compressImg(file,maxW,q){
 return new Promise(r=>{
 const rd=new FileReader();
 rd.onload=e=>{
 const img=new Image();
 img.onload=()=>{
 const c=document.createElement('canvas');
 let w=img.width,h=img.height;
 if(w>maxW){h=h*maxW/w;w=maxW;}
 c.width=w;c.height=h;
 c.getContext('2d').drawImage(img,0,0,w,h);
 r(c.toDataURL('image/jpeg',q));
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
 for(let i=0;i<files.length;i++){
 prog.textContent=`A processar foto ${i+1} de ${files.length}...`;
 photos.push(await compressImg(files[i],800,0.7));
 }
 prog.style.display='none';
 }
 const editId=document.getElementById('editHouseId').value;
 const data={title,zone,status,rooms,living,kitchen,bathrooms,electricity,yard,price,ownerContact,desc};
 if(editId){
 if(photos.length===0)photos=allHouses.find(h=>h.id===editId)?.photos||[];
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
 }catch(e){toast("Erro: "+e.message,"error");}
 finally{btn.disabled=false;btn.textContent=" Guardar Casa";}
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
 const mf=filterModeActive==='todos'?true:filterModeActive==='disponivel'?(!h.status||h.status==='disponivel'):filterModeActive==='reservada'?h.status==='reservada':filterModeActive==='quintal'?h.yard:filterModeActive==='energia'?h.electricity:true;
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
 const sc=h.status||'disponivel';
 const hj=JSON.stringify({title:h.title,ownerContact:h.ownerContact,zone:h.zone,price:h.price});
 div.innerHTML=`
 <div class="card-gallery" id="g-${h.id}">
<img src="${photos[0]||ph}" alt="foto" data-idx="0" data-photos='${JSON.stringify(photos)}' onerror="this.src='${ph}'">
 ${photos.length>1?`<button class="gallery-btn gallery-prev" onclick="gNav('${h.id}',-1)">‹</button><button class="gallery-btn gallery-next" onclick="gNav('${h.id}',1)">›</button><div class="gallery-count"><span id="gc-${h.id}">1</span>/${photos.length}</div>`:''}
 <div class="status-badge ${sc}">${sl[sc]||'Disponível'}</div>
</div>
<div class="card-body">
<div class="card-title">${h.title}</div>
 ${h.zone?`<div class="card-zone"> ${h.zone}</div>`:''}
 <div class="card-features">
 ${h.rooms>0?`<span class="feature-tag"> ${h.rooms}q</span>`:''}
 ${h.living>0?`<span class="feature-tag"> ${h.living}s</span>`:''}
 ${h.bathrooms>0?`<span class="feature-tag"> ${h.bathrooms}wc</span>`:''}
 ${h.electricity?`<span class="feature-tag"></span>`:''}
 ${h.yard?`<span class="feature-tag"></span>`:''}
 </div>
<div class="card-price">${Number(h.price).toLocaleString('pt-PT')} Kz<small>/mês</small></div>
 ${h.desc?`<div class="card-desc">${h.desc.length>100?h.desc.slice(0,100)+'…':h.desc}</div>`:''}
 <div class="card-actions"><button class="btn-success" onclick='showContact(${hj})'> Contactar</button></div>
</div>
 ${currentUser?.isAdmin?`<div class="card-admin-actions"><button class="btn-secondary" onclick="editHouse('${h.id}')"> Editar</button><button class="btn-danger" onclick="delHouse('${h.id}')"> Apagar</button></div>`:''}`;
 list.appendChild(div);
 });
}

function showContact(h){
 document.getElementById('contactInfo').innerHTML=`<b>${h.title}</b><br><br>
<b>${h.ownerContact||'Não disponível'}</b><br> ${h.zone||'—'}<br> ${Number(h.price).toLocaleString('pt-PT')} Kz/mês`;
 document.getElementById('contactModal').classList.remove('hidden');
}

function gNav(id,dir){
 const g=document.getElementById(`g-${id}`);
 const img=g.querySelector('img');
 const photos=JSON.parse(img.dataset.photos||'[]');
 if(photos.length<=1)return;
 let idx=parseInt(img.dataset.idx||0)+dir;
 if(idx<0)idx=photos.length-1;if(idx>=photos.length)idx=0;
 img.style.opacity=0;
 setTimeout(()=>{img.src=photos[idx];img.dataset.idx=idx;img.style.opacity=1;},200);
 const c=document.getElementById(`gc-${id}`);if(c)c.textContent=idx+1;
}

function delHouse(id){
 showModal('Apagar casa','Esta ação é irreversível. Confirmas?','Apagar',async()=>{
 await db.collection('houses').doc(id).delete();
 toast("Casa apagada.","success");
 renderHouses();
 });
}

document.getElementById('searchInput').addEventListener('input',()=>renderHouses());

// ADMIN 
async function loadAdmin(){
 if(!currentUser?.isAdmin){toast("Acesso negado!","error");showPage('menuPage');return;}
 try{
 const [uSnap,hSnap]=await Promise.all([db.collection('users').get(),db.collection('houses').get()]);
 const users=uSnap.docs.map(d=>({uid:d.id,...d.data()}));
 const houses=hSnap.docs.map(d=>({id:d.id,...d.data()}));
 const avail=houses.filter(h=>!h.status||h.status==='disponivel').length;
 document.getElementById('adminStats').innerHTML=`
 <div class="stat-card"><span class="stat-num">${users.length}</span><span class="stat-label">Utilizadores</span></div>
<div class="stat-card"><span class="stat-num">${houses.length}</span><span class="stat-label">Casas</span></div>
<div class="stat-card"><span class="stat-num">${avail}</span><span class="stat-label">Disponíveis</span></div>
<div class="stat-card"><span class="stat-num">${houses.length-avail}</span><span class="stat-label">Arrendadas</span></div>`;
 const list=document.getElementById('userList');list.innerHTML='';
 users.forEach(u=>{
 const isSelf=u.uid===currentUser.uid;
 const item=document.createElement('div');item.className='user-item';
 item.innerHTML=`
 <div class="user-avatar" style="width:36px;height:36px;font-size:14px;flex-shrink:0;">${(u.name||'?')[0].toUpperCase()}</div>
<div class="user-item-info">
<strong>${u.name||'—'} ${u.isAdmin?'<span class="admin-badge">ADMIN</span>':''} ${isSelf?'<span style="font-size:10px;color:var(--text2);">(você)</span>':''}</strong>
<span> ${u.phone||'—'} · ${u.email||'—'}</span>
</div>
<div class="user-item-actions">
 ${!isSelf?(u.isAdmin?`<button class="btn-danger btn-sm" onclick="setAdmin('${u.uid}',false)">- Admin</button>`:`<button class="btn-success btn-sm" onclick="setAdmin('${u.uid}',true)">+ Admin</button>`):''}
 ${!isSelf?`<button class="btn-secondary btn-sm" onclick="delUser('${u.uid}')"></button>`:''}
 </div>`;
 list.appendChild(item);
 });
 }catch(e){
 document.getElementById('userList').innerHTML='<p style="color:var(--danger);">Erro ao carregar utilizadores.</p>';
 }
}

async function setAdmin(uid,val){
 await db.collection('users').doc(uid).update({isAdmin:val});
 toast(val?"Admin adicionado!":"Admin removido.","success");
 loadAdmin();
}

function delUser(uid){
 showModal('Apagar utilizador','Esta ação é permanente. Confirmas?','Apagar',async()=>{
 await db.collection('users').doc(uid).delete();
 toast("Utilizador apagado.","success");
 loadAdmin();
 });
}

// BUTTONS 
document.getElementById('btnRegister').onclick=()=>showPage('registerPage');
document.getElementById('btnLogin').onclick=()=>showPage('loginPage');
document.getElementById('googleLoginBtn').onclick=()=>loginWithGoogle();
document.getElementById('googleRegisterBtn').onclick=()=>loginWithGoogle();
// Topbar logout button
const _logBtn=document.getElementById('logoutTopBtn');
if(_logBtn){
  _logBtn.onclick=()=>{
    showModal('Sair','Tem a certeza que quer sair?','Sair',async()=>{
      await auth.signOut();
      toast("Sessão encerrada.","info");
    });
  };
}
function _updateLogBtn(){
  if(_logBtn) _logBtn.classList.toggle('hidden',!currentUser);
}

// ── MEDIA THUMB ──
function isVideo(src){return src&&(src.startsWith('data:video')||/\.(mp4|webm|ogg|mov)$/i.test(src));}

function renderMediaThumb(src, allMedia, idx, houseId){
  if(isVideo(src)){
    return `<video src="\${src}" style="width:100%;height:190px;object-fit:cover;display:block;cursor:zoom-in;background:#000;" muted playsinline ondblclick="openLightbox(\${JSON.stringify(allMedia)},\${idx})" data-idx="\${idx}" data-photos='\${JSON.stringify(allMedia)}'></video>`;
  }
  return `<img src="\${src}" alt="foto" data-idx="\${idx}" data-photos='\${JSON.stringify(allMedia)}' onerror="this.src='\${src}'" style="cursor:zoom-in;" ondblclick="openLightbox(\${JSON.stringify(allMedia)},\${idx})">`;
}

// ── LIGHTBOX ──
let _lbMedia=[], _lbIdx=0;

function openLightbox(media, idx){
  _lbMedia = media; _lbIdx = idx;
  lbShow();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
  const v=document.getElementById('lbVid');
  v.pause(); v.src='';
  document.body.style.overflow='';
}

function lbNav(dir){
  _lbIdx = (_lbIdx + dir + _lbMedia.length) % _lbMedia.length;
  lbShow();
}

function lbShow(){
  const src = _lbMedia[_lbIdx];
  const img = document.getElementById('lbImg');
  const vid = document.getElementById('lbVid');
  const ctr = document.getElementById('lbCounter');
  const prev= document.getElementById('lbPrev');
  const next= document.getElementById('lbNext');

  if(isVideo(src)){
    img.style.display='none';
    vid.style.display='block';
    vid.src=src; vid.load();
  } else {
    vid.style.display='none'; vid.pause(); vid.src='';
    img.style.display='block';
    img.src=src;
  }
  ctr.textContent = _lbMedia.length > 1 ? (_lbIdx+1)+' / '+_lbMedia.length : '';
  prev.style.display = _lbMedia.length > 1 ? 'flex' : 'none';
  next.style.display = _lbMedia.length > 1 ? 'flex' : 'none';
}

// Close lightbox with Escape key
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeLightbox();
  if(e.key==='ArrowLeft') lbNav(-1);
  if(e.key==='ArrowRight') lbNav(1);
});

// Fix gNav to support video thumbs
const _origGNav = gNav;
function gNav(id, dir){
  const g=document.getElementById('g-'+id);
  const media=g.querySelector('[data-photos]');
  if(!media) return;
  const photos=JSON.parse(media.dataset.photos||'[]');
  if(photos.length<=1)return;
  let idx=parseInt(media.dataset.idx||0)+dir;
  if(idx<0)idx=photos.length-1;if(idx>=photos.length)idx=0;

  const newSrc = photos[idx];
  const container = g;

  if(isVideo(newSrc)){
    // Replace with video
    const oldEl = container.querySelector('img,video');
    if(oldEl){
      oldEl.style.opacity=0;
      setTimeout(()=>{
        oldEl.outerHTML = renderMediaThumb(newSrc, photos, idx, id);
      },200);
    }
  } else {
    const img=g.querySelector('img');
    if(img){img.style.opacity=0;setTimeout(()=>{img.src=newSrc;img.dataset.idx=idx;img.style.opacity=1;},200);}
    const vid=g.querySelector('video');
    if(vid){vid.style.opacity=0;setTimeout(()=>{vid.outerHTML=`<img src="\${newSrc}" alt="foto" data-idx="\${idx}" data-photos='\${JSON.stringify(photos)}' style="cursor:zoom-in;" ondblclick="openLightbox(\${JSON.stringify(photos)},\${idx})">`;},200);}
  }
  const c=document.getElementById('gc-'+id);if(c)c.textContent=idx+1;
}
