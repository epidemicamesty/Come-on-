document.getElementById('scraper-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const q = document.getElementById('query').value.trim();
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  results.innerHTML='';
  status.textContent='Fetching…';

  // Build absolute function URL on this domain (works on Netlify/GitHub+Netlify)
  const base = window.FUNCTION_BASE || (location.origin + '/.netlify/functions');
  const url = `${base}/scraper?q=${encodeURIComponent(q)}`;

  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if(data.error){ status.textContent = 'Error: ' + data.error; return; }
    status.textContent = `Found ${data.results.length} items for "${data.query}"`;
    if(!data.results.length){ return; }
    for(const item of data.results){
      const card = document.createElement('div');
      card.className='card';
      if(item.type==='video'){
        const v=document.createElement('video'); v.controls=true; v.src=item.url; card.appendChild(v);
      } else {
        const img=document.createElement('img'); img.loading='lazy'; img.src=item.url; card.appendChild(img);
      }
      const meta=document.createElement('small');
      meta.textContent = item.source || 'unknown';
      card.appendChild(meta);
      results.appendChild(card);
    }
  }catch(err){
    status.textContent='Request failed: ' + err.message;
  }
});