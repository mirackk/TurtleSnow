const dialog=document.createElement('dialog');dialog.className='feedback-dialog';
dialog.innerHTML=`<form id="feedback-form"><div class="feedback-heading"><h2 id="feedback-title"></h2><button type="button" id="feedback-close" aria-label="Close">×</button></div><label><span id="feedback-category-label"></span><select name="category"><option value="suggestion"></option><option value="data"></option><option value="bug"></option></select></label><label><span id="feedback-message-label"></span><textarea name="message" minlength="5" maxlength="2000" rows="5" required></textarea></label><label><span id="feedback-email-label"></span><input name="email" type="email" maxlength="254" autocomplete="email"></label><div class="feedback-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><p id="feedback-privacy"></p><p id="feedback-result" role="status"></p><button class="feedback-send" id="feedback-send" type="submit"></button></form>`;
document.body.append(dialog);
const button=document.createElement('button');button.className='feedback-launch';button.type='button';document.body.append(button);
const $=id=>document.getElementById(id);const en=()=>document.documentElement.lang==='en';const t=(a,b)=>en()?b:a;
let sending=false;
function text(){
 button.textContent=t('意见反馈','Feedback');$('feedback-title').textContent=t('意见反馈','Share feedback');
 $('feedback-close').ariaLabel=t('关闭','Close');$('feedback-category-label').textContent=t('类型','Category');
 const opts=dialog.querySelectorAll('option');[t('功能建议','Suggestion'),t('数据问题','Data issue'),t('网站故障','Website bug')].forEach((v,i)=>opts[i].textContent=v);
 $('feedback-message-label').textContent=t('反馈内容（5–2000 字符）','Message (5–2000 characters)');$('feedback-email-label').textContent=t('邮箱（选填，方便回复）','Email (optional, for a reply)');
 $('feedback-privacy').textContent=t('反馈和选填邮箱将存储在 TurtleSnow 的 Cloudflare 数据库，仅供站点运营者查看。请勿提交密码或敏感信息。','Your feedback and optional email are stored in TurtleSnow’s Cloudflare database for the site operator to review. Please omit passwords or sensitive information.');
 $('feedback-send').textContent=sending?t('提交中…','Sending…'):t('提交反馈','Send feedback');
}
button.onclick=()=>{text();$('feedback-result').textContent='';dialog.showModal()};$('feedback-close').onclick=()=>dialog.close();
new MutationObserver(text).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});text();
$('feedback-form').onsubmit=async event=>{
 event.preventDefault();if(sending)return;
 const form=event.currentTarget;if(!form.reportValidity())return;
 sending=true;$('feedback-send').disabled=true;text();$('feedback-result').textContent='';
 const d=Object.fromEntries(new FormData(form));d.language=en()?'en':'zh';d.resort=$('resort').value;
 try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d),signal:AbortSignal.timeout(15000)});if(!r.ok){$('feedback-result').textContent=r.status===429?t('提交太频繁，请一小时后再试。','Too many submissions. Please try again in an hour.'):t('提交失败，请稍后重试。','Unable to send. Please try again later.');return}
 form.reset();$('feedback-result').textContent=t('已收到，谢谢你的反馈！','Received — thank you for your feedback!');
 }catch{$('feedback-result').textContent=t('网络异常，请稍后重试。','Connection failed. Please try again later.')}
 finally{sending=false;$('feedback-send').disabled=false;text()}
};
