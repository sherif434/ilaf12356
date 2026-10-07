const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
document.documentElement.classList.add('js');
$('#year').textContent=new Date().getFullYear();
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});
$$('.reveal').forEach(el=>observer.observe(el));
const menu=$('.menu-btn'), mobile=$('.mobile-menu');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));mobile.classList.toggle('open',!open);mobile.setAttribute('aria-hidden',String(open));document.body.classList.toggle('menu-open',!open)});
$$('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>{menu?.setAttribute('aria-expanded','false');mobile.classList.remove('open');mobile.setAttribute('aria-hidden','true');document.body.classList.remove('menu-open')}));
const dot=$('.cursor-dot'),ring=$('.cursor-ring');
if(matchMedia('(pointer:fine)').matches){document.addEventListener('mousemove',e=>{dot.style.left=e.clientX+'px';dot.style.top=e.clientY+'px';ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px'});$$('a,button,.service-card,.gallery-item').forEach(el=>{el.addEventListener('mouseenter',()=>{ring.style.width='58px';ring.style.height='58px';ring.style.background='rgba(214,255,63,.05)'});el.addEventListener('mouseleave',()=>{ring.style.width='34px';ring.style.height='34px';ring.style.background='transparent'})})}
$$('.magnetic').forEach(el=>{el.addEventListener('mousemove',e=>{if(matchMedia('(pointer:fine)').matches){const r=el.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)*.12;const y=(e.clientY-r.top-r.height/2)*.12;el.style.transform=`translate(${x}px,${y}px)`}});el.addEventListener('mouseleave',()=>el.style.transform='')});
let last=0;window.addEventListener('scroll',()=>{const y=scrollY;if(y>20){$('.site-header').style.background='rgba(11,13,15,.72)';$('.site-header').style.backdropFilter='blur(16px)'}else{$('.site-header').style.background='transparent';$('.site-header').style.backdropFilter='none'}last=y},{passive:true});
