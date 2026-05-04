// ─────────────────────────────────────────
// CONFIGURAÇÃO SUPABASE
// ─────────────────────────────────────────
const SUPABASE_URL = 'https://ccprtfpnseuubbpbupjh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcHJ0ZnBuc2V1dWJicGJ1cGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDI5MTcsImV4cCI6MjA5MzM3ODkxN30.1y2tbx4-VDffikdZfffI9j9ih6Cv19hH2VrzXwwLIfw';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allHouses = [];
let pendingModal = null;
let editingHouseId = null;
let _suppressAuthChange = false;

// ─────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────
const modeBtn = document.getElementById('toggleMode');
if(modeBtn){
  if(localStorage.getItem('dcpc_theme')==='dark'){
    document.body.classList.add('dark');
    modeBtn.textContent='Claro';
  }
  modeBtn.onclick=()=>{
    document.body.classList.toggle('dark');
    const d=document.body.classList.contains('dark');
    modeBtn.textContent=d?'Claro':'Escuro';
    localStorage.setItem('dcpc_theme',d?'dark':'light');
  };
}

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────
function toast(msg,type='info'){
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.textContent=msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),3300);
}

// ─────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// PAGES
// ─────────────────────────────────────────
function showPage(id){
  document.querySelectorAll('.container').forEach(d=>d.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo(0,0);
  if(id==='searchPage') renderHouses();
  if(id==='menuPage'){startSlideshow();updateMenu();}
  if(id==='adminPage') loadAdmin();
  if(id==='profilePage') loadProfile();
  if(id==='rentPage'&&(!currentUser||!currentUser.isAdmin)){
    toast("Apenas administradores!","error");showPage('menuPage');return;
  }
}

function goBack(){
  showPage(currentUser?'menuPage':'startPage');
}
document.getElementById('supportBack').onclick=()=>goBack();

// ─────────────────────────────────────────
// MENU
// ─────────────────────────────────────────
function updateMenu(){
  const a=currentUser?.isAdmin;
  document.getElementById('btnRent').classList.toggle('hidden',!a);
  document.getElementById('btnAdmin').classList.toggle('hidden',!a);
  document.getElementById('menuAdminBadge').classList.toggle('hidden',!a);
  document.getElementById('menuAvatar').textContent=(currentUser?.name||'?')[0].toUpperCase();
  document.getElementById('menuUserName').textContent=currentUser?.name||'—';
  document.getElementById('menuUserEmail').textContent=currentUser?.email||'—';
  _updateLogBtn();
}

// ─────────────────────────────────────────
// SLIDESHOW
// ─────────────────────────────────────────
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
  const img=document.getElementById('imagem');
  const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
  img.src=slides[0];img.onerror=()=>{img.onerror=null;img.src=ph;};
  renderDots();
  st=setInterval(()=>goSlide((si+1)%slides.length),3000);
}

// ─────────────────────────────────────────
// PASS STRENGTH
// ─────────────────────────────────────────
function checkPassStrength(v){
  const bar=document.getElementById('passBar');
  let s=0;
  if(v.length>=6)s++;if(v.length>=10)s++;
  if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
  bar.style.width=(s*20)+'%';
  bar.style.background=['#ccc','#c0392b','#e08c1a','#e0c01a','#1a7a4a','#1a7a4a'][s];
}

// ─────────────────────────────────────────
// AUTH ERRORS
// ─────────────────────────────────────────
function errMsg(e){
  const msg=e?.message||'';
  if(msg.includes('already registered')||msg.includes('already been registered')) return 'Este email já está registado.';
  if(msg.includes('invalid email')) return 'Email inválido.';
  if(msg.includes('Password should be')) return 'Password demasiado fraca (mínimo 6 caracteres).';
  if(msg.includes('Invalid login credentials')) return 'Email ou password incorretos.';
  if(msg.includes('Email not confirmed')) return 'Email não verificado. Verifica o teu email.';
  if(msg.includes('Too many requests')) return 'Demasiadas tentativas. Tenta mais tarde.';
  return msg||'Erro desconhecido.';
}

// ─────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────
document.getElementById('registerBtn').onclick=async()=>{
  const name=document.getElementById('rName').value.trim();
  const phone=document.getElementById('rPhone').value.trim();
  const email=document.getElementById('rEmail').value.trim();
  const pass=document.getElementById('rPass').value.trim();
  const pass2=document.getElementById('rPass2').value.trim();
  if(!name||!phone||!email||!pass) return toast("Preencha todos os campos!","error");
  if(pass.length<6) return toast("Password: mínimo 6 caracteres!","error");
  if(pass!==pass2) return toast("As passwords não coincidem!","error");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast("Insere um email válido!","error");
  const fakedomains=['mailinator.com','tempmail.com','guerrillamail.com','10minutemail.com','yopmail.com','trashmail.com','fakeinbox.com','sharklasers.com','maildrop.cc','discard.email','getnada.com'];
  const domain=email.split('@')[1]?.toLowerCase();
  if(fakedomains.includes(domain)) return toast("Este domínio de email não é permitido!","error");
  const btn=document.getElementById('registerBtn');
  btn.disabled=true;btn.textContent="⏳ A criar conta...";
  try{
    const {data,error}=await sb.auth.signUp({
      email,password:pass,
      options:{data:{name,phone}}
    });
    if(error) throw error;
    await sb.from('users').insert({
      id:data.user.id,name,phone,email,is_admin:false
    });
    toast("Conta criada! Verifica o teu email antes de entrar 📧","success");
    showPage('loginPage');
  }catch(e){
    toast(errMsg(e),"error");
  }finally{
    btn.disabled=false;btn.textContent="Confirmar Cadastro";
  }
};

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
document.getElementById('loginBtn').onclick=async()=>{
  const email=document.getElementById('lEmail').value.trim();
  const pass=document.getElementById('lPass').value.trim();
  if(!email||!pass) return toast("Preencha email e password!","error");
  const btn=document.getElementById('loginBtn');
  btn.disabled=true;btn.textContent="⏳ A entrar...";
  try{
    const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
    if(error) throw error;
    if(!data.user.email_confirmed_at){
      await sb.auth.signOut();
      toast("Email não verificado! Verifica a tua caixa de correio 📧","error");
      document.getElementById('resendVerif').classList.remove('hidden');
      document.getElementById('resendVerif').dataset.email=email;
      _pendingResendPass=pass;
      btn.disabled=false;btn.textContent="Entrar";
      return;
    }
    document.getElementById('resendVerif').classList.add('hidden');
    btn.disabled=false;btn.textContent="Entrar";
  }catch(e){
    toast(errMsg(e),"error");
    btn.disabled=false;btn.textContent="Entrar";
  }
};

let _pendingResendPass='';

async function resendEmail(){
  const div=document.getElementById('resendVerif');
  const email=div.dataset.email;
  if(!email) return toast("Faz login primeiro.","error");
  try{
    const {error}=await sb.auth.resend({type:'signup',email});
    if(error) throw error;
    toast("Email reenviado! Verifica o spam também 📬","success");
  }catch(e){toast(errMsg(e),"error");}
}

// ─────────────────────────────────────────
// RECOVER PASSWORD
// ─────────────────────────────────────────
let lastRecoverEmail='',resendTimer=null;

document.getElementById('recoverBtn').onclick=async()=>{
  const email=document.getElementById('recEmail').value.trim();
  if(!email) return toast("Insere o teu email!","error");
  const btn=document.getElementById('recoverBtn');
  btn.disabled=true;btn.textContent="⏳ A enviar...";
  try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{
      redirectTo:window.location.origin
    });
    if(error) throw error;
    lastRecoverEmail=email;
    document.getElementById('recoverStep1').classList.add('hidden');
    document.getElementById('recoverStep2').classList.remove('hidden');
    document.getElementById('recEmailSent').textContent=email;
    startResendCooldown();
  }catch(e){
    toast(errMsg(e),"error");
  }finally{
    btn.disabled=false;btn.textContent="📧 Enviar Link de Recuperação";
  }
};

async function resendRecovery(){
  if(!lastRecoverEmail) return;
  const btn=document.getElementById('resendRecoverBtn');
  btn.disabled=true;btn.textContent="⏳ A reenviar...";
  try{
    const {error}=await sb.auth.resetPasswordForEmail(lastRecoverEmail,{redirectTo:window.location.origin});
    if(error) throw error;
    toast("Email reenviado! Verifica o spam 📬","success");
    startResendCooldown();
  }catch(e){toast("Erro ao reenviar.","error");}
  finally{btn.disabled=false;btn.textContent="📧 Reenviar Email";}
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

// ─────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────
function logout(){
  showModal('Sair','Tem a certeza que quer sair?','Sair',async()=>{
    await sb.auth.signOut();
    toast("Sessão encerrada.","info");
  });
}

// ─────────────────────────────────────────
// AUTH STATE
// ─────────────────────────────────────────
function hideLoader(){
  const ls=document.getElementById('loadingScreen');
  if(!ls) return;
  ls.style.opacity='0';
  setTimeout(()=>ls.style.display='none',400);
}
setTimeout(hideLoader,8000);

sb.auth.onAuthStateChange(async(event,session)=>{
  if(_suppressAuthChange) return;
  if(session?.user){
    try{
      const {data}=await sb.from('users').select('*').eq('id',session.user.id).single();
      currentUser={
        uid:session.user.id,
        email:session.user.email,
        name:data?.name||session.user.user_metadata?.name||'Utilizador',
        phone:data?.phone||'',
        isAdmin:data?.is_admin||false
      };
    }catch(e){
      currentUser={uid:session.user.id,email:session.user.email,name:'Utilizador',phone:'',isAdmin:false};
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
  _updateLogBtn();
});

// ─────────────────────────────────────────
// GOOGLE AUTH
// ─────────────────────────────────────────
async function loginWithGoogle(){
  try{
    const {error}=await sb.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin}
    });
    if(error) throw error;
  }catch(e){
    toast(errMsg(e),"error");
  }
}

// Criar perfil Google se não existir
sb.auth.getSession().then(async({data:{session}})=>{
  if(!session) return;
  const user=session.user;
  const {data:existing}=await sb.from('users').select('id').eq('id',user.id).single();
  if(!existing){
    await sb.from('users').insert({
      id:user.id,
      name:user.user_metadata?.full_name||'Utilizador',
      phone:'',email:user.email,is_admin:false
    });
  }
});

// ─────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────
function loadProfile(){
  if(!currentUser) return;
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
  if(!name) return toast("O nome não pode estar vazio!","error");
  const btn=document.getElementById('saveProfileBtn');
  btn.disabled=true;btn.textContent="⏳ A guardar...";
  try{
    await sb.from('users').update({name,phone}).eq('id',currentUser.uid);
    if(passNew){
      if(passNew.length<6){
        toast("Password: mínimo 6 caracteres!","error");
        return;
      }
      const {error}=await sb.auth.updateUser({password:passNew});
      if(error) throw error;
    }
    currentUser.name=name;currentUser.phone=phone;
    toast("Perfil atualizado!","success");
    updateMenu();
  }catch(e){toast(e.message||"Erro ao guardar.","error");}
  finally{btn.disabled=false;btn.textContent="Guardar Alterações";}
};

// ─────────────────────────────────────────
// HOUSES
// ─────────────────────────────────────────
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
  if(!currentUser?.isAdmin) return;
  const h=allHouses.find(h=>h.id===id);if(!h) return;
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
  document.getElementById('ownerContact').value=h.owner_contact||'';
  document.getElementById('desc').value=h.desc||'';
  document.getElementById('electricity').value=String(h.electricity);
  document.getElementById('yard').value=String(h.yard);
  document.getElementById('houseStatus').value=h.status||'disponivel';
  showPage('rentPage');
}

// Comprimir imagem
function compressImg(file,maxW,q){
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
        c.toBlob(blob=>resolve(blob),'image/jpeg',q);
      };
      img.src=e.target.result;
    };
    rd.readAsDataURL(file);
  });
}

document.getElementById('saveHouse').onclick=async()=>{
  if(!currentUser?.isAdmin) return toast("Apenas administradores!","error");
  const title=document.getElementById('title').value.trim();
  const price=document.getElementById('price').value.trim();
  if(!title||!price) return toast("Título e preço são obrigatórios!","error");
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
  btn.disabled=true;btn.textContent="⏳ A guardar...";
  try{
    const prog=document.getElementById('uploadProgress');
    let mediaUrls=[];
    if(files.length>0){
      prog.style.display='block';
      for(let i=0;i<files.length;i++){
        prog.textContent=`A enviar ficheiro ${i+1} de ${files.length}...`;
        const file=files[i];
        const isVid=file.type.startsWith('video/');
        const ext=file.name.split('.').pop().toLowerCase();
        const path=`houses/${currentUser.uid}_${Date.now()}_${i}.${ext}`;
        let uploadFile=file;
        if(!isVid){
          uploadFile=await compressImg(file,800,0.75);
        }
        const {error:upErr}=await sb.storage.from('houses-media').upload(path,uploadFile,{
          contentType:isVid?file.type:'image/jpeg',upsert:false
        });
        if(upErr) throw upErr;
        const {data:urlData}=sb.storage.from('houses-media').getPublicUrl(path);
        mediaUrls.push(urlData.publicUrl);
      }
      prog.style.display='none';
    }
    const editId=document.getElementById('editHouseId').value;
    const data={title,zone,status,rooms,living,kitchen,bathrooms,electricity,yard,price,owner_contact:ownerContact,desc};
    if(editId){
      if(mediaUrls.length===0) mediaUrls=allHouses.find(h=>h.id===editId)?.media_urls||[];
      data.media_urls=mediaUrls;
      const {error}=await sb.from('houses').update({...data,updated_at:new Date().toISOString()}).eq('id',editId);
      if(error) throw error;
      toast("Casa atualizada!","success");
    }else{
      data.media_urls=mediaUrls;
      data.created_by=currentUser.uid;
      const {error}=await sb.from('houses').insert(data);
      if(error) throw error;
      toast("Casa cadastrada!","success");
    }
    showPage('menuPage');
  }catch(e){toast("Erro: "+e.message,"error");}
  finally{btn.disabled=false;btn.textContent="🏠 Guardar Casa";}
};

// ─────────────────────────────────────────
// RENDER HOUSES
// ─────────────────────────────────────────
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

function escapeHtml(str){
  if(!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function renderHouses(){
  const list=document.getElementById('houseList');
  list.innerHTML='<div class="spinner"></div>';
  try{
    const {data,error}=await sb.from('houses').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    allHouses=data||[];
  }catch(e){
    list.innerHTML='<div class="empty-state"><div class="empty-icon">🏠</div><p>Erro ao carregar casas.<br>Verifica a tua ligação.</p></div>';
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
    list.innerHTML='<div class="empty-state"><div class="empty-icon">🏠</div><p>Nenhuma casa encontrada.</p></div>';
    return;
  }
  const sl={disponivel:'Disponível',reservada:'Reservada',arrendada:'Arrendada'};
  const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
  houses.forEach(h=>{
    const div=document.createElement('div');div.className='house-card';
    const photos=h.media_urls&&h.media_urls.length?h.media_urls:[];
    const sc=h.status||'disponivel';
    const hj=JSON.stringify({title:h.title,ownerContact:h.owner_contact,zone:h.zone,price:h.price});
    const safeTitle=escapeHtml(h.title);
    const safeZone=escapeHtml(h.zone);
    const safeDesc=h.desc?escapeHtml(h.desc.length>100?h.desc.slice(0,100)+'…':h.desc):'';
    div.innerHTML=`
    <div class="card-gallery" id="g-${h.id}">
      <img src="${photos[0]||ph}" alt="foto" data-idx="0" data-houseid="${h.id}" onerror="this.onerror=null;this.src='${ph}'" style="cursor:zoom-in;" ondblclick="openLightboxById('${h.id}',0)">
      ${photos.length>1?`<button class="gallery-btn gallery-prev" onclick="gNav('${h.id}',-1)">‹</button><button class="gallery-btn gallery-next" onclick="gNav('${h.id}',1)">›</button><div class="gallery-count"><span id="gc-${h.id}">1</span>/${photos.length}</div>`:''}
      <div class="status-badge ${sc}">${sl[sc]||'Disponível'}</div>
    </div>
    <div class="card-body">
      <div class="card-title">${safeTitle}</div>
      ${h.zone?`<div class="card-zone">📍 ${safeZone}</div>`:''}
      <div class="card-features">
        ${h.rooms>0?`<span class="feature-tag">Quarto: ${h.rooms}</span>`:''}
        ${h.living>0?`<span class="feature-tag">Sala: ${h.living}</span>`:''}
        ${h.kitchen>0?`<span class="feature-tag">Cozinha: ${h.kitchen}</span>`:''}
        ${h.bathrooms>0?`<span class="feature-tag">WC: ${h.bathrooms}</span>`:''}
        <span class="feature-tag">${h.electricity?'Com Energia':'Sem Energia'}</span>
        <span class="feature-tag">${h.yard?'Com Quintal':'Sem Quintal'}</span>
      </div>
      <div class="card-price">${Number(h.price).toLocaleString('pt-PT')} Kz<small>/mês</small></div>
      ${h.desc?`<div class="card-desc">${safeDesc}</div>`:''}
      <div class="card-actions"><button class="btn-success" onclick='showContact(${hj})'>📞 Contactar</button></div>
    </div>
    ${currentUser?.isAdmin?`<div class="card-admin-actions"><button class="btn-secondary" onclick="editHouse('${h.id}')">✏️ Editar</button><button class="btn-danger" onclick="delHouse('${h.id}')">🗑️ Apagar</button></div>`:''}`;
    list.appendChild(div);
  });
}

// ─────────────────────────────────────────
// SHOW CONTACT
// ─────────────────────────────────────────
function showContact(h){
  const info=document.getElementById('contactInfo');
  info.innerHTML='';
  const title=document.createElement('b');title.textContent=h.title||'';
  const br1=document.createElement('br');
  const br2=document.createElement('br');
  const contact=document.createElement('b');contact.textContent=h.ownerContact||'Não disponível';
  const br3=document.createElement('br');
  const zone=document.createTextNode('📍 '+(h.zone||'—'));
  const br4=document.createElement('br');
  const price=document.createTextNode('💰 '+Number(h.price).toLocaleString('pt-PT')+' Kz/mês');
  info.append(title,br1,br2,contact,br3,zone,br4,price);
  document.getElementById('contactModal').classList.remove('hidden');
}

// ─────────────────────────────────────────
// GALLERY NAV
// ─────────────────────────────────────────
function isVideo(src){
  return src&&(src.includes('.mp4')||src.includes('.webm')||src.includes('.ogg')||src.includes('.mov')||src.startsWith('data:video'));
}

function renderMediaThumb(src,allMedia,idx,houseId){
  if(isVideo(src)){
    return `<video src="${src}" style="width:100%;height:190px;object-fit:cover;display:block;cursor:zoom-in;background:#000;" muted playsinline ondblclick="openLightboxById('${houseId}',${idx})" data-idx="${idx}" data-houseid="${houseId}"></video>`;
  }
  const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
  return `<img src="${src}" alt="foto" data-idx="${idx}" data-houseid="${houseId}" onerror="this.onerror=null;this.src='${ph}'" style="cursor:zoom-in;" ondblclick="openLightboxById('${houseId}',${idx})">`;
}

function gNav(id,dir){
  const g=document.getElementById('g-'+id);
  if(!g) return;
  const house=allHouses.find(h=>h.id===id);
  if(!house) return;
  const photos=house.media_urls&&house.media_urls.length?house.media_urls:[];
  if(photos.length<=1) return;
  const media=g.querySelector('[data-idx]');
  let idx=parseInt(media?.dataset.idx||0)+dir;
  if(idx<0) idx=photos.length-1;
  if(idx>=photos.length) idx=0;
  const newSrc=photos[idx];
  if(isVideo(newSrc)){
    const oldEl=g.querySelector('img,video');
    if(oldEl){oldEl.style.opacity=0;setTimeout(()=>{oldEl.outerHTML=renderMediaThumb(newSrc,photos,idx,id);},200);}
  }else{
    const img=g.querySelector('img');
    const ph="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23c8873a22' width='400' height='200'/%3E%3Ctext y='55%25' x='50%25' text-anchor='middle' dominant-baseline='middle' font-size='48'%3E%F0%9F%8F%A1%3C/text%3E%3C/svg%3E";
    if(img){
      img.style.opacity=0;
      setTimeout(()=>{
        img.onerror=()=>{img.onerror=null;img.src=ph;};
        img.src=newSrc;img.dataset.idx=idx;
        img.setAttribute('ondblclick',`openLightboxById('${id}',${idx})`);
        img.style.opacity=1;
      },200);
    }
    const vid=g.querySelector('video');
    if(vid){vid.style.opacity=0;setTimeout(()=>{vid.outerHTML=`<img src="${newSrc}" alt="foto" data-idx="${idx}" data-houseid="${id}" style="cursor:zoom-in;" onerror="this.onerror=null;this.src='${ph}'" ondblclick="openLightboxById('${id}',${idx})">`;},200);}
  }
  const c=document.getElementById('gc-'+id);if(c) c.textContent=idx+1;
}

function delHouse(id){
  showModal('Apagar casa','Esta ação é irreversível. Confirmas?','Apagar',async()=>{
    const house=allHouses.find(h=>h.id===id);
    if(house?.media_urls?.length){
      const paths=house.media_urls.map(url=>{
        const parts=url.split('/houses-media/');
        return parts[1]||null;
      }).filter(Boolean);
      if(paths.length) await sb.storage.from('houses-media').remove(paths);
    }
    await sb.from('houses').delete().eq('id',id);
    toast("Casa apagada.","success");
    renderHouses();
  });
}

document.getElementById('searchInput').addEventListener('input',()=>renderHouses());

// ─────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────
async function loadAdmin(){
  if(!currentUser?.isAdmin){toast("Acesso negado!","error");showPage('menuPage');return;}
  try{
    const [{data:users},{data:houses}]=await Promise.all([
      sb.from('users').select('*'),
      sb.from('houses').select('*')
    ]);
    const avail=(houses||[]).filter(h=>!h.status||h.status==='disponivel').length;
    document.getElementById('adminStats').innerHTML=`
    <div class="stat-card"><span class="stat-num">${(users||[]).length}</span><span class="stat-label">Utilizadores</span></div>
    <div class="stat-card"><span class="stat-num">${(houses||[]).length}</span><span class="stat-label">Casas</span></div>
    <div class="stat-card"><span class="stat-num">${avail}</span><span class="stat-label">Disponíveis</span></div>
    <div class="stat-card"><span class="stat-num">${(houses||[]).length-avail}</span><span class="stat-label">Arrendadas</span></div>`;
    const list=document.getElementById('userList');list.innerHTML='';
    (users||[]).forEach(u=>{
      const isSelf=u.id===currentUser.uid;
      const item=document.createElement('div');item.className='user-item';
      item.innerHTML=`
      <div class="user-avatar" style="width:36px;height:36px;font-size:14px;flex-shrink:0;">${escapeHtml((u.name||'?')[0].toUpperCase())}</div>
      <div class="user-item-info">
        <strong>${escapeHtml(u.name||'—')} ${u.is_admin?'<span class="admin-badge">ADMIN</span>':''} ${isSelf?'<span style="font-size:10px;color:var(--text2);">(você)</span>':''}</strong>
        <span>📞 ${escapeHtml(u.phone||'—')} · ${escapeHtml(u.email||'—')}</span>
      </div>
      <div class="user-item-actions">
        ${!isSelf?(u.is_admin?`<button class="btn-danger btn-sm" onclick="setAdmin('${u.id}',false)">- Admin</button>`:`<button class="btn-success btn-sm" onclick="setAdmin('${u.id}',true)">+ Admin</button>`):''}
        ${!isSelf?`<button class="btn-secondary btn-sm" onclick="delUser('${u.id}')">❌</button>`:''}
      </div>`;
      list.appendChild(item);
    });
  }catch(e){
    document.getElementById('userList').innerHTML='<p style="color:var(--danger);">Erro ao carregar utilizadores.</p>';
  }
}

async function setAdmin(uid,val){
  await sb.from('users').update({is_admin:val}).eq('id',uid);
  toast(val?"Admin adicionado!":"Admin removido.","success");
  loadAdmin();
}

function delUser(uid){
  showModal('Apagar utilizador','Esta ação é permanente. Confirmas?','Apagar',async()=>{
    await sb.from('users').delete().eq('id',uid);
    toast("Utilizador apagado.","success");
    loadAdmin();
  });
}

// ─────────────────────────────────────────
// BUTTONS
// ─────────────────────────────────────────
document.getElementById('btnRegister').onclick=()=>showPage('registerPage');
document.getElementById('btnLogin').onclick=()=>showPage('loginPage');
document.getElementById('googleLoginBtn').onclick=()=>loginWithGoogle();
document.getElementById('googleRegisterBtn').onclick=()=>loginWithGoogle();

const _logBtn=document.getElementById('logoutTopBtn');
if(_logBtn) _logBtn.onclick=()=>logout();
function _updateLogBtn(){
  if(_logBtn) _logBtn.classList.toggle('hidden',!currentUser);
}

// ─────────────────────────────────────────
// LIGHTBOX
// ─────────────────────────────────────────
let _lbMedia=[],_lbIdx=0;

function openLightboxById(id,idx){
  const h=allHouses.find(h=>h.id===id);
  if(!h) return;
  const media=h.media_urls&&h.media_urls.length?h.media_urls:[];
  if(!media.length) return;
  openLightbox(media,idx);
}

function openLightbox(media,idx){
  _lbMedia=media;_lbIdx=idx;
  lbShow();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeLightbox(){
  document.getElementById('lightbox').classList.remove('open');
  const v=document.getElementById('lbVid');
  if(v){v.pause();v.src='';}
  document.body.style.overflow='';
}

function lbNav(dir){
  if(!_lbMedia.length) return;
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
    vid.style.display='block';
    vid.src=src;vid.load();
  }else{
    vid.style.display='none';vid.pause();vid.src='';
    img.style.display='block';
    img.src=src;
  }
  ctr.textContent=_lbMedia.length>1?(_lbIdx+1)+' / '+_lbMedia.length:'';
  prev.style.display=_lbMedia.length>1?'flex':'none';
  next.style.display=_lbMedia.length>1?'flex':'none';
}

document.addEventListener('keydown',e=>{
  const isOpen=document.getElementById('lightbox')?.classList.contains('open');
  if(e.key==='Escape') closeLightbox();
  if(isOpen&&e.key==='ArrowLeft') lbNav(-1);
  if(isOpen&&e.key==='ArrowRight') lbNav(1);
});
