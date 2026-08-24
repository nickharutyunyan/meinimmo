'use client';
import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '@/components/Brand';

export default function Home() {
  const router=useRouter(); const [url,setUrl]=useState(''); const [status,setStatus]=useState('');
  async function assess(payload: object) { const res=await fetch('/api/assess',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); const data=await res.json() as {error?:string;id?:string};if(!res.ok||!data.id){setStatus(data.error||'The assessment could not be created.');return;}router.push(`/r/${data.id}`); }
  async function submit(event: FormEvent) { event.preventDefault();setStatus('Reading listing…');await assess({url}); }
  async function upload(event: ChangeEvent<HTMLInputElement>) { const file=event.target.files?.[0];if(!file)return;setStatus('Reading Exposé…');try{const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.394/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text='';for(let page=1;page<=pdf.numPages;page++){const content=await pdf.getPage(page).then(x=>x.getTextContent());text+=content.items.map(x=>('str' in x?x.str:'')).join(' ')+'\n';}if(text.trim().length<150){setStatus('This PDF appears to be scanned. Please upload a text-searchable Exposé.');return;}await assess({text,name:file.name});}catch{setStatus('The PDF could not be read. Try a text-searchable Exposé.');}}
  return <main className="landing">
    <nav><Brand/><div className="nav-note">Independent property briefs <span>Germany</span></div><a href="#how">Our approach</a></nav>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">FOR THOUGHTFUL HOME BUYERS</p><h1>See the home.<br/><em>Not the sales pitch.</em></h1><p className="editorial-note"><span>01</span> Facts before opinions. Every unknown stays visible.</p></div>
      <div className="intake-panel">
        <p className="eyebrow">START A PROPERTY BRIEF</p><h2>Bring the listing.<br/>We’ll find what matters.</h2>
        <form onSubmit={submit} className="intake"><label><span>↗</span><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a property listing URL" type="url" required/></label><button>Assess property</button></form>
        <div className="upload-row"><span>or</span><label>Upload an Exposé PDF <input onChange={upload} accept="application/pdf" type="file"/></label></div>
        {status ? <p className={!status.includes('Reading') ? 'error' : 'hint'}>{status}</p> : null}
      </div>
    </section>
    <section id="how" className="approach-head"><p className="eyebrow">OUR APPROACH</p><h2>Less brochure. More due diligence.</h2></section>
    <section className="steps"><div><b>01</b><h2>Read the source</h2><p>We validate the listing and keep marketing claims separate from stated facts.</p></div><div><b>02</b><h2>Build the brief</h2><p>Price, costs, location and building details are structured into one calm view.</p></div><div><b>03</b><h2>Prepare the questions</h2><p>Missing evidence becomes a useful question for the seller, agent or WEG.</p></div></section>
  </main>;
}
