const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

document.documentElement.classList.add('js');
const year=$('#year'); if(year) year.textContent=new Date().getFullYear();

const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
  if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}
}),{threshold:.12});
$$('.reveal').forEach(el=>observer.observe(el));

const menu=$('.menu-btn'), mobile=$('.mobile-menu');
menu?.addEventListener('click',()=>{
  const open=menu.getAttribute('aria-expanded')==='true';
  menu.setAttribute('aria-expanded',String(!open));
  mobile?.classList.toggle('open',!open);
  mobile?.setAttribute('aria-hidden',String(open));
  document.body.classList.toggle('menu-open',!open);
});
$$('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>{
  menu?.setAttribute('aria-expanded','false');mobile?.classList.remove('open');
  mobile?.setAttribute('aria-hidden','true');document.body.classList.remove('menu-open');
}));

const dot=$('.cursor-dot'),ring=$('.cursor-ring');
if(window.matchMedia('(pointer:fine)').matches){
 document.addEventListener('mousemove',e=>{
  if(dot){dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px'}
  if(ring){ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px'}
 });
 $$('a,button,.service-card,.gallery-item').forEach(el=>{
  el.addEventListener('mouseenter',()=>{if(ring){ring.style.width='58px';ring.style.height='58px'}});
  el.addEventListener('mouseleave',()=>{if(ring){ring.style.width='34px';ring.style.height='34px'}});
 });
}
$$('.magnetic').forEach(el=>{
 el.addEventListener('mousemove',e=>{
  if(window.matchMedia('(pointer:fine)').matches){
   const r=el.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)*.12,y=(e.clientY-r.top-r.height/2)*.12;
   el.style.transform=`translate(${x}px,${y}px)`;
  }
 });
 el.addEventListener('mouseleave',()=>el.style.transform='');
});
window.addEventListener('scroll',()=>{
 const y=scrollY,h=$('.site-header');
 if(h){h.style.background=y>20?'rgba(11,13,15,.72)':'transparent';h.style.backdropFilter=y>20?'blur(16px)':'none'}
},{passive:true});

const sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
let currentUser=null,currentProfile=null,services=[];

function normalizePhone(value){
 let p=String(value||'').replace(/\s|-/g,'');
 if(p.startsWith('00')) p='+'+p.slice(2);
 if(/^01\d{9}$/.test(p)) return '+20'+p.slice(1);
 if(/^20\d{10}$/.test(p)) return '+'+p;
 return p.startsWith('+')?p:'+'+p;
}
function showStatus(id,msg,error=false){const el=$(id);if(el){el.textContent=msg;el.style.color=error?'#ff7b7b':'#d6ff3f'}}
function openAuth(){
 const m=$('#auth-modal');if(!m)return;m.classList.add('open');m.setAttribute('aria-hidden','false');
 setTimeout(()=>$('#auth-phone')?.focus(),80);
}
function closeAuth(){const m=$('#auth-modal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')}
$$('[data-close-auth]').forEach(x=>x.addEventListener('click',closeAuth));
const authPhone=$('#auth-phone'),passField=$('#password-field');
authPhone?.addEventListener('input',()=>{
 const valid=/^01\d{9}$/.test(authPhone.value.replace(/\D/g,''));
 passField?.classList.toggle('show',valid);
});

function addTopControls(){
 const header=$('.site-header'); if(!header)return;
 const controls=document.createElement('div');controls.className='site-controls';
 controls.innerHTML='<button class="control-btn" id="theme-btn" type="button" aria-label="تغيير المظهر">☾</button><button class="control-btn" id="account-btn" type="button">حسابي</button>';
 header.insertBefore(controls,menu||header.lastChild);
 $('#theme-btn')?.addEventListener('click',()=>{
  document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('washing-theme',document.documentElement.classList.contains('light-mode')?'light':'dark');
  $('#theme-btn').textContent=document.documentElement.classList.contains('light-mode')?'☀':'☾';
 });
 $('#account-btn')?.addEventListener('click',()=>currentUser?location.hash='#account':openAuth());
 if(localStorage.getItem('washing-theme')==='light'){document.documentElement.classList.add('light-mode');$('#theme-btn').textContent='☀'}
}
addTopControls();

function showPrivateSections(){
 const account=$('#account'),dashboard=$('#dashboard');
 if(account)account.style.display=currentUser?'block':'none';
 if(dashboard)dashboard.style.display=currentProfile?.role==='admin'||currentProfile?.role==='manager'?'block':'none';
}
function renderAuthButton(){
 const b=$('#account-btn');
 if(b)b.textContent=currentUser?'حسابي':'دخول';
}
async function loadServices(){
 const {data,error}=await sb.from('services').select('*').eq('active',true).order('sort_order');
 if(error){console.error(error);return}
 services=data||[];
 const select=$('#booking-service'); if(!select)return;
 select.innerHTML='<option value="">اختار الخدمة</option>'+services.map(s=>`<option value="${s.id}">${s.name} — ${Number(s.price).toLocaleString('ar-EG')} ج.م</option>`).join('');
}
async function loadProfile(){
 if(!currentUser){currentProfile=null;showPrivateSections();renderAuthButton();return}
 const {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
 currentProfile=data||null;
 $('#account-name').textContent=currentProfile?.full_name||'عميل';
 $('#account-phone').textContent=currentProfile?.phone||currentUser.phone||'—';
 showPrivateSections();renderAuthButton();
}
async function loadAccount(){
 if(!currentUser)return;
 const {data:bookings}=await sb.from('bookings').select('id,booking_date,booking_time,status,total_price,services(name)').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10);
 const rows=bookings||[];
 $('#account-bookings').textContent=rows.length;
 const {data:favs}=await sb.from('favorites').select('service_id').eq('user_id',currentUser.id);
 $('#account-favorites').textContent=(favs||[]).length;
 $('#booking-history').innerHTML=rows.length?rows.map(b=>`<div class="history-row"><span>${b.services?.name||'خدمة'}</span><span>${b.booking_date} · ${String(b.booking_time||'').slice(0,5)}</span><span class="status-pill">${statusAr(b.status)}</span><strong>${Number(b.total_price||0).toLocaleString('ar-EG')} ج.م</strong></div>`).join(''):'<p class="section-head p">لا توجد حجوزات حتى الآن.</p>';
}
function statusAr(s){return({pending:'قيد الانتظار',confirmed:'تمت الموافقة',preparing:'جاري التجهيز',completed:'تم التسليم',cancelled:'ملغي',rejected:'تم الرفض'})[s]||s}

async function loadDashboard(){
 if(!currentProfile||!['admin','manager'].includes(currentProfile.role))return;
 const {data:stats,error}=await sb.from('dashboard_stats').select('*').single();
 if(error){console.error(error);return}
 $('#stat-total').textContent=stats.total_bookings||0;
 $('#stat-pending').textContent=stats.pending_bookings||0;
 $('#stat-confirmed').textContent=stats.confirmed_bookings||0;
 $('#stat-completed').textContent=stats.completed_bookings||0;
 $('#stat-customers').textContent=stats.customers||0;
 $('#stat-revenue').textContent=Number(stats.revenue||0).toLocaleString('ar-EG')+' ج.م';
 const {data:rows}=await sb.from('bookings').select('id,customer_name,phone,booking_date,booking_time,status,total_price,services(name)').order('created_at',{ascending:false}).limit(20);
 $('#admin-bookings').innerHTML=(rows||[]).map(b=>`<div class="admin-row"><span>${b.customer_name}<br><small>${b.phone}</small></span><span>${b.services?.name||'خدمة'}<br>${b.booking_date}</span><span class="status-pill">${statusAr(b.status)}</span><strong>${Number(b.total_price||0).toLocaleString('ar-EG')} ج.م</strong></div>`).join('')||'<p>لا توجد حجوزات.</p>';
}
async function refreshApp(){
 const {data:{user}}=await sb.auth.getUser();currentUser=user||null;
 await loadProfile();await loadServices();await loadAccount();await loadDashboard();
}
$('#auth-form')?.addEventListener('submit',async e=>{
 e.preventDefault();
 const phone=normalizePhone(authPhone.value),password=$('#auth-password').value;
 if(!/^\+20\d{10}$/.test(phone))return showStatus('#auth-status','اكتب رقم مصري صحيح.',true);
 if(password.length<6)return showStatus('#auth-status','كلمة المرور لازم تكون 6 أحرف أو أرقام على الأقل.',true);
 showStatus('#auth-status','جاري تسجيل الدخول...');
 const {error}=await sb.auth.signInWithPassword({phone,password});
 if(error)return showStatus('#auth-status','بيانات الدخول غير صحيحة أو الحساب يحتاج تفعيل رقم الهاتف.',true);
 closeAuth();await refreshApp();location.hash='#account';
});
$('#signup-btn')?.addEventListener('click',async()=>{
 const phone=normalizePhone(authPhone.value),password=$('#auth-password').value;
 if(!/^\+20\d{10}$/.test(phone))return showStatus('#auth-status','اكتب رقم مصري صحيح.',true);
 showStatus('#auth-status','جاري إنشاء الحساب...');
 const {data,error}=await sb.auth.signUp({phone,password});
 if(error)return showStatus('#auth-status',error.message||'تعذر إنشاء الحساب.',true);
 if(data.session){closeAuth();await refreshApp();location.hash='#account'}
 else showStatus('#auth-status','تم إنشاء الحساب. لو التحقق بالرسائل مفعّل، أدخل كود SMS المرسل على الرقم ثم سجّل الدخول.');
});
$('#logout-btn')?.addEventListener('click',async()=>{await sb.auth.signOut();currentUser=null;currentProfile=null;showPrivateSections();renderAuthButton();location.hash='#top'});
$('#change-password-btn')?.addEventListener('click',async()=>{
 const password=prompt('اكتب كلمة المرور الجديدة (6 أحرف أو أرقام على الأقل):');
 if(!password||password.length<6)return;
 const {error}=await sb.auth.updateUser({password});
 alert(error?'تعذر تغيير كلمة المرور: '+error.message:'تم تغيير كلمة المرور بنجاح.');
});
$('#forgot-password-btn')?.addEventListener('click',()=>{
 showStatus('#auth-status','لو أنت داخل حسابك، استخدم "تغيير كلمة المرور" من صفحة حسابي.',false);
});

$('#booking-form')?.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!currentUser){openAuth();return showStatus('#booking-status','سجّل دخولك أولًا لإتمام الحجز.',true)}
 const service=services.find(s=>s.id===$('#booking-service').value);
 if(!service)return showStatus('#booking-status','اختار الخدمة أولًا.',true);
 showStatus('#booking-status','جاري حفظ الحجز...');
 const {error}=await sb.from('bookings').insert({
  user_id:currentUser.id,service_id:service.id,customer_name:$('#booking-name').value.trim(),
  phone:normalizePhone($('#booking-phone').value),booking_date:$('#booking-date').value,
  booking_time:$('#booking-time').value,notes:$('#booking-notes').value.trim(),total_price:Number(service.price)
 });
 if(error)return showStatus('#booking-status','تعذر حفظ الحجز: '+error.message,true);
 showStatus('#booking-status','تم تسجيل الحجز بنجاح.');
 e.target.reset();await loadAccount();await loadDashboard();
});

sb.auth.onAuthStateChange(async()=>{setTimeout(refreshApp,0)});
refreshApp();
