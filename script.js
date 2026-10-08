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
 if(h){const light=document.documentElement.classList.contains('light-mode');h.style.background=y>20?(light?'rgba(244,243,238,.88)':'rgba(11,13,15,.72)'):'transparent';h.style.backdropFilter=y>20?'blur(16px)':'none'}
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
let authMode='login';
function setAuthMode(mode){
 authMode=mode;
 const owner=mode==='owner';
 const signup=mode==='signup';
 $('#auth-name-field')?.classList.toggle('active',signup && !owner);
 $('#auth-submit').textContent=signup?'إنشاء الحساب':'دخول';
 $('#auth-title').textContent=owner?'دخول المالك':(signup?'اعمل حسابك.':'أهلاً بيك.');
 $('#auth-subtitle').textContent=owner?'استخدم حساب المالك الموجود في Supabase Auth.':(signup?'اكتب اسمك ورقم الموبايل وكلمة المرور.':'اكتب رقم الموبايل وكلمة المرور للدخول.');
 $('#auth-mode-btn').textContent=signup?'عندي حساب بالفعل':'أنا عميل جديد';
 $('#auth-mode-btn').style.display=owner?'none':'';
 $('#signup-btn').style.display=owner?'none':'';
 $('#auth-password').setAttribute('autocomplete',signup?'new-password':'current-password');
}
function openAuth(mode='login'){
 const m=$('#auth-modal');if(!m)return;
 setAuthMode(mode);m.classList.add('open');m.setAttribute('aria-hidden','false');
 setTimeout(()=>$('#auth-phone')?.focus(),80);
}
function closeAuth(){const m=$('#auth-modal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true')}
$$('[data-close-auth]').forEach(x=>x.addEventListener('click',closeAuth));
$('#auth-mode-btn')?.addEventListener('click',()=>setAuthMode(authMode==='login'?'signup':'login'));
const authPhone=$('#auth-phone'),passField=$('#password-field');
authPhone?.addEventListener('input',()=>{
 const digits=authPhone.value.replace(/\D/g,'');
 passField?.classList.toggle('show',/^01\d{9}$/.test(digits));
});
$('#auth-form')?.addEventListener('submit',async e=>{
 e.preventDefault();
 const phone=normalizePhone(authPhone.value),password=$('#auth-password').value.trim(),name=$('#auth-name').value.trim();
 if(!/^\+20\d{10}$/.test(phone))return showStatus('#auth-status','اكتب رقم موبايل مصري صحيح.',true);
 if(password.length<6)return showStatus('#auth-status','كلمة المرور لازم تكون 6 أحرف أو أرقام على الأقل.',true);
 if(authMode==='signup'&&!name)return showStatus('#auth-status','اكتب اسمك الأول.',true);
 showStatus('#auth-status',authMode==='signup'?'جاري إنشاء الحساب...':'جاري تسجيل الدخول...');
 if(authMode==='signup'){
   const {data,error}=await sb.auth.signUp({phone,password,options:{data:{full_name:name}}});
   if(error)return showStatus('#auth-status',error.message||'تعذر إنشاء الحساب.',true);
   if(data.user){
     if(data.session){closeAuth();await refreshApp();location.hash='#account'}
     else showStatus('#auth-status','تم إنشاء الحساب. لو التحقق بالرسائل مفعّل، أكّد الرقم ثم سجّل الدخول.');
   }
 }else{
   const {data,error}=await sb.auth.signInWithPassword({phone,password});
   if(error)return showStatus('#auth-status','بيانات الدخول غير صحيحة.',true);
   if(authMode==='owner'){
     const {data:profile,error:profileError}=await sb.from('profiles').select('role').eq('id',data.user.id).maybeSingle();
     if(profileError||profile?.role!=='admin'){
       await sb.auth.signOut(); currentUser=null; currentProfile=null; showPrivateSections(); renderAuthButton();
       return showStatus('#auth-status','هذا الحساب ليس حساب المالك.',true);
     }
   }
   closeAuth();await refreshApp();location.hash=currentProfile?.role==='admin'?'#dashboard':'#account';
 }
});*/
$('#logout-btn')?.addEventListener('click',async()=>{await sb.auth.signOut();currentUser=null;currentProfile=null;showPrivateSections();renderAuthButton();location.hash='#top'});
$('#change-password-btn')?.addEventListener('click',async()=>{
 const password=prompt('اكتب كلمة المرور الجديدة (6 أحرف أو أرقام على الأقل):');
 if(!password||password.length<6)return;
 const {error}=await sb.auth.updateUser({password});
 alert(error?'تعذر تغيير كلمة المرور: '+error.message:'تم تغيير كلمة المرور بنجاح.');
});

let cart=[];
function renderCart(){
 const list=$('#cart-list'),count=$('#cart-count'),total=$('#cart-total');
 if(!list)return;
 count.textContent=cart.length+' خدمات';
 total.textContent=cart.reduce((sum,x)=>sum+Number(x.price||0),0).toLocaleString('ar-EG')+' ج.م';
 list.innerHTML=cart.length?cart.map((x,i)=>'<div class="cart-row"><div><b>'+escapeHtml(x.name)+'</b><small>'+Number(x.price).toLocaleString('ar-EG')+' ج.م</small></div><button type="button" class="mini-btn danger cart-remove" data-index="'+i+'">حذف</button></div>').join(''):'<p class="cart-empty">السلة فاضية، اختار خدمة.</p>';
 $$('.cart-remove').forEach(b=>b.addEventListener('click',()=>{cart.splice(Number(b.dataset.index),1);renderCart()}));
}
$('#add-to-cart')?.addEventListener('click',()=>{
 const service=services.find(s=>s.id===$('#booking-service').value);
 if(!service)return showStatus('#booking-status','اختار الخدمة الأول.',true);
 if(cart.some(x=>x.id===service.id))return showStatus('#booking-status','الخدمة موجودة بالفعل في السلة.',true);
 cart.push({id:service.id,name:service.name,price:service.price});renderCart();showStatus('#booking-status','اتضافت للسلة.');
});
renderCart();
function addTopControls(){
 const header=$('.site-header'); if(!header)return;
 const controls=document.createElement('div');controls.className='site-controls';
 controls.innerHTML='<button class="control-btn" id="theme-btn" type="button" aria-label="تغيير المظهر">☾</button><button class="control-btn" id="owner-btn" type="button">المالك</button><button class="control-btn" id="account-btn" type="button">حسابي</button>';
 header.insertBefore(controls,menu||header.lastChild);
 $('#theme-btn')?.addEventListener('click',()=>{
  document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('washing-theme',document.documentElement.classList.contains('light-mode')?'light':'dark');
  $('#theme-btn').textContent=document.documentElement.classList.contains('light-mode')?'☀':'☾';
 });
 $('#account-btn')?.addEventListener('click',()=>currentUser?location.hash='#account':openAuth('login'));
 $('#owner-btn')?.addEventListener('click',()=>openAuth('owner'));
 if(localStorage.getItem('washing-theme')==='light'){document.documentElement.classList.add('light-mode');$('#theme-btn').textContent='☀'}
}
addTopControls();

function showPrivateSections(){
 const account=$('#account'),dashboard=$('#dashboard'),management=$('#admin-management');
 const isOwner=!!currentUser&&currentProfile?.role==='admin';
 if(account)account.style.display=currentUser?'block':'none';
 if(dashboard)dashboard.style.display=isOwner?'block':'none';
 if(management)management.style.display=isOwner?'block':'none';
}
function renderAuthButton(){
 const b=$('#account-btn');
 if(b)b.textContent=currentUser?'حسابي':'دخول';
}

async function loadOffers(){
 const box=$('#offers-grid'); if(!box)return;
 const {data,error}=await sb.from('offers').select('*').eq('active',true).order('created_at',{ascending:false});
 if(error){box.innerHTML='<p class="error-text">تعذر تحميل العروض حاليًا.</p>';return}
 box.innerHTML=(data||[]).length?(data||[]).map(o=>'<article class="offer-card reveal"><span class="offer-badge">خصم '+Number(o.discount_percent)+'%</span><h3>'+escapeHtml(o.title)+'</h3><p>'+escapeHtml(o.description||'عرض لفترة محدودة.')+'</p><a class="btn btn-primary" href="#booking">احجز العرض ↗</a></article>').join(''):'<div class="offer-empty">لا توجد عروض نشطة حاليًا.</div>';
}
async function loadFavorites(){
 const box=$('#favorite-list'); if(!box)return;
 if(!currentUser){box.innerHTML='<p>سجّل دخولك لإدارة المفضلة.</p>';return}
 const {data,error}=await sb.from('favorites').select('service_id,services(name,price)').eq('user_id',currentUser.id);
 if(error){box.innerHTML='<p class="error-text">تعذر تحميل المفضلة.</p>';return}
 box.innerHTML=(data||[]).length?(data||[]).map(x=>'<div class="favorite-row"><span>'+escapeHtml(x.services?.name||'خدمة')+'</span><b>'+Number(x.services?.price||0).toLocaleString('ar-EG')+' ج.م</b><button class="mini-btn danger remove-favorite" data-id="'+x.service_id+'">إزالة</button></div>').join(''):'<p>لسه مفيش خدمات في المفضلة.</p>';
 $('.remove-favorite').forEach(btn=>btn.addEventListener('click',async()=>{const {error}=await sb.from('favorites').delete().eq('user_id',currentUser.id).eq('service_id',btn.dataset.id);if(error)alert('تعذر إزالة الخدمة');else{await loadFavorites();await loadAccount();}}));
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
 if(!currentProfile||currentProfile.role!=='admin')return;
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
 await loadProfile();await loadServices();await loadOffers();await loadAccount();await loadFavorites();await loadDashboard();
}
$('#booking-form')?.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!currentUser){openAuth('login');return showStatus('#booking-status','سجّل دخولك أولًا لإتمام الحجز.',true)}
 if(!cart.length)return showStatus('#booking-status','اختار خدمة واحدة على الأقل وأضفها للسلة.',true);
 const name=$('#booking-name').value.trim(),phone=normalizePhone($('#booking-phone').value);
 if(!name)return showStatus('#booking-status','اكتب الاسم.',true);
 if(!/^\+20\d{10}$/.test(phone))return showStatus('#booking-status','اكتب رقم موبايل مصري صحيح.',true);
 const first=cart[0];
 showStatus('#booking-status','جاري حفظ الحجز...');
 const {error}=await sb.from('bookings').insert({
   user_id:currentUser.id,service_id:first.id,customer_name:name,phone,
   booking_date:$('#booking-date').value,booking_time:$('#booking-time').value,
   notes:($('#booking-notes').value.trim()||'')+' | الخدمات: '+cart.map(x=>x.name).join('، '),
   vehicle_model:$('#vehicle-model').value.trim(),total_price:cart.reduce((sum,x)=>sum+Number(x.price||0),0)
 });
 if(error)return showStatus('#booking-status','تعذر حفظ الحجز: '+error.message,true);
 showStatus('#booking-status','تم تسجيل الحجز بنجاح.');
 e.target.reset();cart=[];renderCart();await loadAccount();await loadDashboard();
});

sb.auth.onAuthStateChange(async()=>{setTimeout(refreshApp,0)});
refreshApp();


async function isManager(){
 if(!currentUser)return false;
 const {data}=await sb.from('profiles').select('role').eq('id',currentUser.id).maybeSingle();
 return !!data&&data.role==='admin';
}
function escapeHtml(v){
 return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function adminTabs(){
 $$('.admin-tab').forEach(btn=>btn.addEventListener('click',async()=>{
  $$('.admin-tab').forEach(x=>x.classList.toggle('active',x===btn));
  $$('.admin-pane').forEach(x=>x.classList.toggle('active',x.dataset.adminPane===btn.dataset.adminTab));
  await loadAdminPane(btn.dataset.adminTab);
 }));
}
async function loadAdminPane(tab){
 if(!await isManager())return;
 if(tab==='bookings')return loadManageBookings();
 if(tab==='services')return loadManageServices();
 if(tab==='offers')return loadManageOffers();
 if(tab==='customers')return loadManageCustomers();
 if(tab==='reviews')return loadManageReviews();
}
async function loadManageBookings(){
 const {data,error}=await sb.from('bookings').select('id,customer_name,phone,booking_date,booking_time,status,total_price,vehicle_model,notes,services(name)').order('created_at',{ascending:false}).limit(100);
 if(error)return $('#manage-bookings').innerHTML='<p class="error-text">تعذر تحميل الحجوزات.</p>';
 const statuses=['pending','confirmed','preparing','completed','rejected','cancelled'];
 $('#manage-bookings').innerHTML=(data||[]).length?'<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>العميل</th><th>السيارة</th><th>الخدمة</th><th>الموعد</th><th>الحالة</th><th>السعر</th><th>إجراء</th></tr></thead><tbody>'+
 (data||[]).map(b=>'<tr><td>'+escapeHtml(b.customer_name)+'<small>'+escapeHtml(b.phone)+'</small></td><td>'+escapeHtml(b.vehicle_model||'—')+'</td><td>'+escapeHtml(b.services?.name||'—')+'</td><td>'+escapeHtml(b.booking_date)+'<small>'+escapeHtml(String(b.booking_time||'').slice(0,5))+'</small></td><td><select class="admin-status" data-id="'+b.id+'">'+statuses.map(s=>'<option value="'+s+'" '+(s===b.status?'selected':'')+'>'+statusAr(s)+'</option>').join('')+'</select></td><td>'+Number(b.total_price||0).toLocaleString('ar-EG')+' ج.م</td><td><button class="mini-btn danger delete-booking" data-id="'+b.id+'">حذف</button></td></tr>').join('')+
 '</tbody></table></div>':'<p>لا توجد حجوزات.</p>';
 $$('.admin-status').forEach(x=>x.addEventListener('change',async()=>{const {error}=await sb.from('bookings').update({status:x.value}).eq('id',x.dataset.id);if(error)alert('تعذر تغيير الحالة');else{await loadManageBookings();await loadDashboard();}}));
 $$('.delete-booking').forEach(x=>x.addEventListener('click',async()=>{if(!confirm('حذف الحجز نهائيًا؟'))return;const {error}=await sb.from('bookings').delete().eq('id',x.dataset.id);if(error)alert('تعذر الحذف');else{await loadManageBookings();await loadDashboard();}}));
}
function resetServiceForm(){const f=$('#service-form');f?.reset();$('#service-id').value='';$('#service-active').checked=true;$('#service-duration').value=60;$('#service-order').value=0}
async function loadManageServices(){
 const {data,error}=await sb.from('services').select('*').order('sort_order').order('created_at');
 if(error)return $('#manage-services').innerHTML='<p class="error-text">تعذر تحميل الخدمات.</p>';
 $('#manage-services').innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الخدمة</th><th>السعر</th><th>المدة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+
 (data||[]).map(s=>'<tr><td><b>'+escapeHtml(s.name)+'</b><small>'+escapeHtml(s.description||'')+'</small></td><td>'+Number(s.price).toLocaleString('ar-EG')+' ج.م</td><td>'+s.duration_minutes+' دقيقة</td><td>'+(s.active?'نشطة':'متوقفة')+'</td><td><button class="mini-btn edit-service" data-json="'+encodeURIComponent(JSON.stringify(s))+'">تعديل</button> <button class="mini-btn danger delete-service" data-id="'+s.id+'">حذف</button></td></tr>').join('')+'</tbody></table></div>';
 $$('.edit-service').forEach(x=>x.addEventListener('click',()=>{const s=JSON.parse(decodeURIComponent(x.dataset.json));$('#service-id').value=s.id;$('#service-name').value=s.name;$('#service-price').value=s.price;$('#service-duration').value=s.duration_minutes;$('#service-order').value=s.sort_order;$('#service-description').value=s.description||'';$('#service-active').checked=s.active;scrollTo({top:$('#service-form').getBoundingClientRect().top+scrollY-100,behavior:'smooth'})}));
 $$('.delete-service').forEach(x=>x.addEventListener('click',async()=>{if(!confirm('حذف الخدمة؟ لو عليها حجوزات قد يمنع قاعدة البيانات الحذف.'))return;const {error}=await sb.from('services').delete().eq('id',x.dataset.id);if(error)alert('تعذر الحذف: '+error.message);else{await loadManageServices();await loadServices();}}));
}
$('#service-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!await isManager())return;const id=$('#service-id').value;const payload={name:$('#service-name').value.trim(),price:Number($('#service-price').value),duration_minutes:Number($('#service-duration').value),sort_order:Number($('#service-order').value),description:$('#service-description').value.trim(),active:$('#service-active').checked};const q=id?sb.from('services').update(payload).eq('id',id):sb.from('services').insert(payload);const {error}=await q;if(error)alert('تعذر حفظ الخدمة: '+error.message);else{resetServiceForm();await loadManageServices();await loadServices();}});
$('#service-cancel')?.addEventListener('click',resetServiceForm);
async function loadManageOffers(){
 const {data,error}=await sb.from('offers').select('*').order('created_at',{ascending:false});
 if(error)return $('#manage-offers').innerHTML='<p class="error-text">تعذر تحميل العروض.</p>';
 $('#manage-offers').innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>العرض</th><th>الخصم</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+
 (data||[]).map(o=>'<tr><td><b>'+escapeHtml(o.title)+'</b><small>'+escapeHtml(o.description||'')+'</small></td><td>'+Number(o.discount_percent)+'%</td><td>'+(o.active?'نشط':'متوقف')+'</td><td><button class="mini-btn edit-offer" data-json="'+encodeURIComponent(JSON.stringify(o))+'">تعديل</button> <button class="mini-btn danger delete-offer" data-id="'+o.id+'">حذف</button></td></tr>').join('')+'</tbody></table></div>';
 $$('.edit-offer').forEach(x=>x.addEventListener('click',()=>{const o=JSON.parse(decodeURIComponent(x.dataset.json));$('#offer-id').value=o.id;$('#offer-title').value=o.title;$('#offer-discount').value=o.discount_percent;$('#offer-description').value=o.description||'';$('#offer-active').checked=o.active;scrollTo({top:$('#offer-form').getBoundingClientRect().top+scrollY-100,behavior:'smooth'})}));
 $$('.delete-offer').forEach(x=>x.addEventListener('click',async()=>{if(!confirm('حذف العرض؟'))return;const {error}=await sb.from('offers').delete().eq('id',x.dataset.id);if(error)alert('تعذر الحذف: '+error.message);else loadManageOffers();}));
}
$('#offer-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!await isManager())return;const id=$('#offer-id').value;const payload={title:$('#offer-title').value.trim(),discount_percent:Number($('#offer-discount').value),description:$('#offer-description').value.trim(),active:$('#offer-active').checked};const q=id?sb.from('offers').update(payload).eq('id',id):sb.from('offers').insert(payload);const {error}=await q;if(error)alert('تعذر حفظ العرض: '+error.message);else{e.target.reset();$('#offer-id').value='';$('#offer-active').checked=true;loadManageOffers();}});
$('#offer-cancel')?.addEventListener('click',()=>{ $('#offer-form')?.reset();$('#offer-id').value='';$('#offer-active').checked=true;});
async function loadManageCustomers(){
 const {data,error}=await sb.from('profiles').select('id,phone,full_name,role,created_at').order('created_at',{ascending:false}).limit(200);
 if(error)return $('#manage-customers').innerHTML='<p class="error-text">تعذر تحميل العملاء.</p>';
 $('#manage-customers').innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>الدور</th><th>التاريخ</th></tr></thead><tbody>'+(data||[]).map(x=>'<tr><td>'+escapeHtml(x.full_name||'بدون اسم')+'</td><td>'+escapeHtml(x.phone)+'</td><td>'+escapeHtml(x.role)+'</td><td>'+new Date(x.created_at).toLocaleDateString('ar-EG')+'</td></tr>').join('')+'</tbody></table></div>';
}
async function loadManageReviews(){
 const {data,error}=await sb.from('reviews').select('id,rating,comment,approved,created_at,profiles(full_name,phone)').order('created_at',{ascending:false}).limit(100);
 if(error)return $('#manage-reviews').innerHTML='<p class="error-text">تعذر تحميل التقييمات.</p>';
 $('#manage-reviews').innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>العميل</th><th>التقييم</th><th>التعليق</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+(data||[]).map(x=>'<tr><td>'+escapeHtml(x.profiles?.full_name||x.profiles?.phone||'عميل')+'</td><td>'+x.rating+' ★</td><td>'+escapeHtml(x.comment||'—')+'</td><td>'+(x.approved?'منشور':'معلق')+'</td><td><button class="mini-btn toggle-review" data-id="'+x.id+'" data-value="'+(!x.approved)+'">'+(x.approved?'إخفاء':'نشر')+'</button> <button class="mini-btn danger delete-review" data-id="'+x.id+'">حذف</button></td></tr>').join('')+'</tbody></table></div>';
 $$('.toggle-review').forEach(x=>x.addEventListener('click',async()=>{const {error}=await sb.from('reviews').update({approved:x.dataset.value==='true'}).eq('id',x.dataset.id);if(error)alert('تعذر تحديث التقييم');else loadManageReviews();}));
 $$('.delete-review').forEach(x=>x.addEventListener('click',async()=>{if(!confirm('حذف التقييم؟'))return;const {error}=await sb.from('reviews').delete().eq('id',x.dataset.id);if(error)alert('تعذر الحذف');else loadManageReviews();}));
}
adminTabs();
const originalLoadDashboard=loadDashboard;
loadDashboard=async function(){await originalLoadDashboard();if(await isManager()){const s=$('#admin-management');if(s)s.style.display='block';await loadManageBookings();}};
