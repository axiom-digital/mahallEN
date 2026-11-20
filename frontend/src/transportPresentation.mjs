// A project timeline is not a list of independent current faults.
export function transportPresentation(alerts, asOf) {
  const current=[],history=[];
  const official=alerts.filter(a=>a.status==='official_notice_visible');
  const reviewed=alerts.filter(a=>['reviewed_project_schedule','official_access_restriction'].includes(a.status));
  current.push(...reviewed,...official);
  const groups=new Map();
  for(const a of alerts){
    if(reviewed.includes(a)||official.includes(a))continue;
    const text=`${a.summary} ${a.affected}`.toLocaleLowerCase('tr-TR');
    const age=a.date?(Date.parse(asOf)-Date.parse(a.date))/86400000:Infinity;
    const duplicateNotice=official.some(o=>text.includes(o.affected)&&/giriş|kısmet/.test(text));
    const historical=a.status==='completion_reported'||age>90||duplicateNotice;
    const group=/çök/.test(text)?'road-collapse':/yurt/.test(text)&&/güzerg/.test(text)?'dorm-route':/çalış/.test(text)&&!reviewed.some(r=>r.kind==='project')?'project':null;
    if(historical||!group){history.push(a);continue;}
    if(!groups.has(group))groups.set(group,{...a,sources:[...a.sources]});
    else {const row=groups.get(group);row.sources=[...new Map([...row.sources,...a.sources].map(s=>[s.url,s])).values()];}
  }
  current.push(...groups.values());
  return {current,history};
}
