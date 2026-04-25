import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

const CONTRACT = "0x4b570b636e4F744199ec82F52d69B08b394ab850";
const API_KEY  = "AZ22N7MWSRDG4934C48KYR2QXEF57M4QW7";

const MARKETPLACES = {
  "0x7be8076f4ea4a4ad08075c2508e481d6c946d12b": "OpenSea v1",
  "0x00000000006c3852cbef3e08e8df289169ede581": "Seaport",
  "0x000000000000ad05ccc4f10045630fb830b95127": "Blur",
  "0x59728544b08ab483533076417fbbb2fd0b17ce3a": "LooksRare",
  "0x74312363e45dcaba76c59ec49a7aa8a65a67eed": "X2Y2",
  "0x0000000000000000000000000000000000000000": "Mint",
};
const NULL_ADDR = "0x0000000000000000000000000000000000000000";
const isMP   = (a) => !!MARKETPLACES[a?.toLowerCase()];
const isNull = (a) => a?.toLowerCase() === NULL_ADDR;
const short  = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : "";
const rndHex = (n) => [...Array(n)].map(()=>Math.floor(Math.random()*16).toString(16)).join("");
const timeAgo = (ts) => {
  const d = Date.now()/1000 - Number(ts);
  if (d < 3600)  return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
};

const DEMO = (() => {
  const now = Math.floor(Date.now()/1000);
  const ws  = Array.from({length:38},()=>"0x"+rndHex(40));
  const txs = [];
  for(let i=0;i<220;i++){
    let fi=Math.floor(Math.random()*ws.length),ti=Math.floor(Math.random()*ws.length);
    while(ti===fi) ti=Math.floor(Math.random()*ws.length);
    txs.push({from:ws[fi],to:ws[ti],tokenID:String(Math.floor(Math.random()*4999)+1),
      timeStamp:String(now-Math.floor(Math.random()*120*86400)),
      hash:"0x"+rndHex(64),marketplace:Math.random()>0.42});
  }
  const w1=ws[0];
  for(let i=0;i<9;i++) txs.push({
    from:ws[Math.floor(Math.random()*(ws.length-1))+1],to:w1,
    tokenID:String(500+i),timeStamp:String(now-Math.floor(Math.random()*72*3600)),
    hash:"0x"+rndHex(64),marketplace:true});
  return txs;
})();

const nodeR = (d) => d.isMP ? 13 : Math.max(5,Math.min(14,4+(d.sent+d.received)*0.55));
const nodeColor = (d,ws) => {
  if(ws.has(d.id)) return "#F5C300";
  if(d.isMP) return "#555";
  const a=d.sent+d.received;
  if(a>10) return "#FFF"; if(a>4) return "#CCC"; return "#555";
};

const Tile = ({label,value,accent}) => (
  <div style={{flex:1,minWidth:0,background:"#111",borderRadius:12,border:"1px solid #222",
    padding:"13px 14px",borderTop:`2px solid ${accent}`,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,
      background:`radial-gradient(ellipse at top left,${accent}0A 0%,transparent 60%)`,pointerEvents:"none"}}/>
    <div style={{fontSize:8,color:"rgba(255,255,255,0.28)",letterSpacing:"0.1em",marginBottom:6,fontFamily:"'DM Mono',monospace"}}>{label}</div>
    <div style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:"'DM Mono',monospace"}}>{value}</div>
  </div>
);

const TabBtn = ({label,active,onClick,badge}) => (
  <button onClick={onClick} style={{flex:1,padding:"8px 2px",border:"none",cursor:"pointer",
    fontSize:8,fontFamily:"'DM Mono',monospace",letterSpacing:"0.05em",transition:"all 0.15s",
    background:active?"rgba(245,195,0,0.07)":"transparent",
    borderBottom:`2px solid ${active?"#F5C300":"transparent"}`,
    color:active?"#F5C300":"rgba(255,255,255,0.28)"}}>
    {label}
    {badge>0&&<span style={{marginLeft:4,fontSize:7,background:"rgba(245,195,0,0.15)",
      border:"1px solid rgba(245,195,0,0.25)",padding:"1px 4px",borderRadius:6,color:"#F5C300"}}>{badge}</span>}
  </button>
);

export default function DAC() {
  const [transfers,setTransfers]   = useState(DEMO);
  const [loading,setLoading]       = useState(false);
  const [demoMode,setDemoMode]     = useState(true);
  const [filterMode,setFilterMode] = useState("all");
  const [selected,setSelected]     = useState(null);
  const [rightTab,setRightTab]     = useState("top10");
  const [apiKey,setApiKey]         = useState(API_KEY);
  const [showInput,setShowInput]   = useState(false);
  const [error,setError]           = useState(null);
  const [loadingProgress,setLoadingProgress] = useState(0);
  const [isMobile,setIsMobile]     = useState(false);
  const svgRef = useRef(null);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{
    (async()=>{
      try {
        let allTxs = [];
        for(let page=1; page<=10; page++){
          setLoadingProgress(page*10);
          const r=await fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokennfttx&contractaddress=${CONTRACT}&page=${page}&offset=1000&sort=asc&apikey=${API_KEY}`);
          const j=await r.json();
          if(j.status==="1"&&j.result?.length>0){
            allTxs = [...allTxs, ...j.result];
            if(j.result.length < 1000) break; // no more pages
          } else {
            break;
          }
        }
        if(allTxs.length>0){
          setTransfers(allTxs.map(tx=>({...tx,marketplace:isMP(tx.from)||isMP(tx.to)})));
          setDemoMode(false);
        }
        setLoadingProgress(0);
      } catch{ setLoadingProgress(0); }
    })();
  },[]);

  const fetchLive = async () => {
    if(!apiKey.trim()) return;
    setLoading(true); setError(null);
    try {
      const r=await fetch(`https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokennfttx&contractaddress=${CONTRACT}&page=1&offset=1000&sort=desc&apikey=${apiKey}`);
      const j=await r.json();
      if(j.status==="1"&&j.result?.length>0){
        setTransfers(j.result.map(tx=>({...tx,marketplace:isMP(tx.from)||isMP(tx.to)})));
        setDemoMode(false); setShowInput(false);
      } else setError(j.message||"No data returned");
    } catch(e){ setError(e.message); }
    setLoading(false);
  };

  // Current NFT holdings per wallet
  const holdings = useMemo(()=>{
    const owner={};
    [...transfers].sort((a,b)=>Number(a.timeStamp)-Number(b.timeStamp))
      .forEach(tx=>{ if(!isNull(tx.to)) owner[tx.tokenID]=tx.to.toLowerCase(); });
    const cnt={};
    Object.values(owner).forEach(a=>{ if(!isMP(a)&&!isNull(a)) cnt[a]=(cnt[a]||0)+1; });
    return cnt;
  },[transfers]);

  const top10 = useMemo(()=>
    Object.entries(holdings).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([addr,count],i)=>({addr,count,rank:i+1}))
  ,[holdings]);

  const recentActivity = useMemo(()=>
    [...transfers].filter(t=>t.marketplace)
      .sort((a,b)=>Number(b.timeStamp)-Number(a.timeStamp)).slice(0,25)
      .map(tx=>({
        tokenID:tx.tokenID, hash:tx.hash, time:tx.timeStamp,
        buyer:tx.to.toLowerCase(), seller:tx.from.toLowerCase(),
        type:isMP(tx.from)?"BUY":"SELL",
      }))
  ,[transfers]);

  const whaleAlerts = useMemo(()=>{
    const now=Date.now()/1000, cnt={};
    transfers.forEach(tx=>{
      if(now-Number(tx.timeStamp)<=48*3600)
        [tx.from,tx.to].forEach(a=>{
          const lc=a.toLowerCase();
          if(!isMP(lc)&&!isNull(lc)) cnt[lc]=(cnt[lc]||0)+1;
        });
    });
    return Object.entries(cnt).filter(([,n])=>n>2)
      .sort((a,b)=>b[1]-a[1]).slice(0,8).map(([addr,count])=>({addr,count}));
  },[transfers]);

  const walletDetail = useMemo(()=>{
    if(!selected) return null;
    const id=selected.id;
    const list=[...transfers]
      .filter(tx=>tx.from.toLowerCase()===id||tx.to.toLowerCase()===id)
      .sort((a,b)=>Number(a.timeStamp)-Number(b.timeStamp));
    return {
      held:    holdings[id]||0,
      bought:  list.filter(tx=>tx.to.toLowerCase()===id&&isMP(tx.from)).length,
      sold:    list.filter(tx=>tx.from.toLowerCase()===id&&isMP(tx.to)).length,
      txCount: list.length,
      first:   list.length?Number(list[0].timeStamp):null,
      last:    list.length?Number(list[list.length-1].timeStamp):null,
    };
  },[selected,transfers,holdings]);

  const graph = useMemo(()=>{
    let txs=transfers;
    if(filterMode==="buysell")    txs=transfers.filter(t=>t.marketplace);
    if(filterMode==="walletonly") txs=transfers.filter(t=>!t.marketplace);
    const nm={},lm={};
    txs.forEach(tx=>{
      const f=tx.from.toLowerCase(),t=tx.to.toLowerCase();
      [f,t].forEach(a=>{if(!nm[a]) nm[a]={id:a,sent:0,received:0,isMP:isMP(a),name:MARKETPLACES[a]};});
      nm[f].sent++; nm[t].received++;
      const k=`${f}>${t}`; if(!lm[k]) lm[k]={source:f,target:t,count:0}; lm[k].count++;
    });
    const nodes=Object.values(nm).sort((a,b)=>(b.sent+b.received)-(a.sent+a.received)).slice(0,90);
    const ids=new Set(nodes.map(n=>n.id));
    return {nodes,links:Object.values(lm).filter(l=>ids.has(l.source)&&ids.has(l.target))};
  },[transfers,filterMode]);

  useEffect(()=>{
    if(!svgRef.current||graph.nodes.length===0) return;
    const el=svgRef.current,W=el.clientWidth||600,H=el.clientHeight||400;
    d3.select(el).selectAll("*").remove();
    const svg=d3.select(el),defs=svg.append("defs");
    [["gy","0.96,0.76,0"],["gw","1,1,1"],["gg","0.35,0.35,0.35"]].forEach(([id,rgb])=>{
      const [r,g,b]=rgb.split(",");
      const f=defs.append("filter").attr("id",id);
      f.append("feGaussianBlur").attr("in","SourceGraphic").attr("stdDeviation",3).attr("result","bl");
      f.append("feColorMatrix").attr("in","bl").attr("type","matrix")
        .attr("values",`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 13 -5`).attr("result","col");
      const m=f.append("feMerge"); m.append("feMergeNode").attr("in","col"); m.append("feMergeNode").attr("in","SourceGraphic");
    });
    const g=svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.05,14]).on("zoom",e=>g.attr("transform",e.transform)));
    const ws=new Set(whaleAlerts.map(a=>a.addr));
    const sn=graph.nodes.map(n=>({...n})),sl=graph.links.map(l=>({...l}));
    const sim=d3.forceSimulation(sn)
      .force("link",d3.forceLink(sl).id(d=>d.id).distance(d=>50+d.count*9).strength(0.38))
      .force("charge",d3.forceManyBody().strength(d=>d.isMP?-260:-65))
      .force("center",d3.forceCenter(W/2,H/2))
      .force("collide",d3.forceCollide(d=>nodeR(d)+5));
    const link=g.append("g").selectAll("line").data(sl).join("line")
      .attr("stroke",d=>d.count>2?"rgba(245,195,0,0.14)":"rgba(255,255,255,0.05)")
      .attr("stroke-width",d=>Math.min(d.count*0.6,2));
    const ng=g.append("g").selectAll("g").data(sn).join("g").style("cursor","pointer")
      .call(d3.drag()
        .on("start",(e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;})
        .on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y;})
        .on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;})
      )
      .on("click",(e,d)=>{
        e.stopPropagation();
        setSelected(graph.nodes.find(n=>n.id===d.id)||null);
        setRightTab("inspector");
      });
    ng.filter(d=>ws.has(d.id)).append("circle").attr("r",d=>nodeR(d)+7)
      .attr("fill","none").attr("stroke","rgba(245,195,0,0.2)").attr("stroke-width",1.5);
    ng.append("circle").attr("r",d=>nodeR(d))
      .attr("fill",d=>nodeColor(d,ws)).attr("fill-opacity",0.9)
      .attr("filter",d=>ws.has(d.id)?"url(#gy)":d.isMP?"url(#gg)":"url(#gw)")
      .attr("stroke",d=>ws.has(d.id)?"rgba(245,195,0,0.5)":d.isMP?"rgba(100,100,100,0.3)":"rgba(255,255,255,0.18)")
      .attr("stroke-width",1);
    ng.filter(d=>d.isMP||(d.sent+d.received>8))
      .append("text").text(d=>d.isMP?(d.name||short(d.id)):short(d.id))
      .attr("font-size","7px").attr("font-family","'DM Mono',monospace")
      .attr("fill","rgba(255,255,255,0.22)").attr("text-anchor","middle")
      .attr("dy",d=>-nodeR(d)-4).attr("pointer-events","none");
    sim.on("tick",()=>{
      link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
          .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      ng.attr("transform",d=>`translate(${d.x||0},${d.y||0})`);
    });
    svg.on("click",()=>setSelected(null));
    return ()=>sim.stop();
  },[graph,whaleAlerts]);

  const stats=useMemo(()=>({
    txs:transfers.length,
    wallets:Object.keys(holdings).length,
    tokens:new Set(transfers.map(t=>t.tokenID)).size,
    mkt:transfers.filter(t=>t.marketplace).length,
  }),[transfers,holdings]);

  const card={background:"#0A0A0A",borderRadius:14,border:"1px solid #1C1C1C",overflow:"hidden"};
  const fBtn=(m,l)=>(
    <button key={m} onClick={()=>setFilterMode(m)} style={{
      padding:isMobile?"4px 8px":"5px 11px",borderRadius:7,cursor:"pointer",
      fontSize:isMobile?8:9,fontFamily:"'DM Mono',monospace",letterSpacing:"0.04em",
      transition:"all 0.15s",whiteSpace:"nowrap",
      background:filterMode===m?"rgba(245,195,0,0.1)":"transparent",
      border:`1px solid ${filterMode===m?"rgba(245,195,0,0.4)":"rgba(255,255,255,0.07)"}`,
      color:filterMode===m?"#F5C300":"rgba(255,255,255,0.28)",
    }}>{l}</button>
  );

  const Inspector = () => selected&&walletDetail ? (
    <div style={{animation:"fadein 0.2s ease"}}>
      <div style={{fontSize:9,color:"#F5C300",wordBreak:"break-all",padding:"7px 10px",
        background:"rgba(245,195,0,0.05)",border:"1px solid rgba(245,195,0,0.12)",borderRadius:8,marginBottom:11}}>
        {selected.isMP?`🏪 ${selected.name||short(selected.id)}`:selected.id}
      </div>
      <div style={{background:"rgba(245,195,0,0.06)",border:"1px solid rgba(245,195,0,0.18)",
        borderRadius:10,padding:"14px",marginBottom:10,textAlign:"center"}}>
        <div style={{fontSize:36,fontWeight:700,color:"#F5C300",fontFamily:"'DM Mono',monospace",lineHeight:1}}>
          {walletDetail.held}
        </div>
        <div style={{fontSize:8,color:"rgba(245,195,0,0.55)",marginTop:5,letterSpacing:"0.1em"}}>
          DOPE APES CURRENTLY HELD
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>
        {[["BOUGHT",walletDetail.bought,"#4ade80"],["SOLD",walletDetail.sold,"#f87171"],
          ["ALL TXS",walletDetail.txCount,"#fff"],
          ["48H ALERT",whaleAlerts.some(a=>a.addr===selected.id)?"⚠ YES":"—",
           whaleAlerts.some(a=>a.addr===selected.id)?"#F5C300":"#444"]
        ].map(([k,v,c])=>(
          <div key={k} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
            borderTop:`2px solid ${c}22`,padding:"9px 7px",borderRadius:8,textAlign:"center"}}>
            <div style={{fontSize:16,color:c,fontWeight:"bold",fontFamily:"'DM Mono',monospace"}}>{v}</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.22)",marginTop:2,letterSpacing:"0.06em"}}>{k}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        {[["FIRST SEEN",walletDetail.first?timeAgo(walletDetail.first):"—"],
          ["LAST ACTIVE",walletDetail.last?timeAgo(walletDetail.last):"—"]
        ].map(([k,v])=>(
          <div key={k} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",
            padding:"7px 8px",borderRadius:8}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.2)",letterSpacing:"0.06em",marginBottom:3}}>{k}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontFamily:"'DM Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,0.12)",fontSize:9,lineHeight:1.9}}>
      <div style={{fontSize:22,marginBottom:8,opacity:0.18}}>◎</div>
      Click any node in the graph<br/>to inspect wallet details
    </div>
  );

  const Top10 = () => top10.length===0
    ? <div style={{textAlign:"center",padding:"20px 0",fontSize:9,color:"rgba(255,255,255,0.15)"}}>Loading…</div>
    : <>{top10.map((h,i)=>(
      <div key={h.addr} onClick={()=>{
        const node=graph.nodes.find(n=>n.id===h.addr);
        if(node){setSelected(node);setRightTab("inspector");}
      }} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 9px",marginBottom:5,
        borderRadius:9,cursor:"pointer",background:"rgba(255,255,255,0.02)",
        border:"1px solid rgba(255,255,255,0.05)",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(245,195,0,0.06)"}
        onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}>
        <div style={{width:22,height:22,borderRadius:6,flexShrink:0,display:"flex",
          alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:"bold",
          background:i<3?"rgba(245,195,0,0.12)":"rgba(255,255,255,0.04)",
          border:`1px solid ${i<3?"rgba(245,195,0,0.25)":"rgba(255,255,255,0.06)"}`,
          color:i<3?"#F5C300":"rgba(255,255,255,0.3)"}}>{h.rank}</div>
        <div style={{flex:1,minWidth:0,fontSize:9,color:"rgba(255,255,255,0.5)",
          fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {short(h.addr)}
        </div>
        <div style={{fontSize:13,fontWeight:"bold",fontFamily:"'DM Mono',monospace",flexShrink:0,
          color:i<3?"#F5C300":"rgba(255,255,255,0.55)"}}>
          {h.count}<span style={{fontSize:8,color:"rgba(255,255,255,0.22)",fontWeight:"normal",marginLeft:3}}>NFTs</span>
        </div>
      </div>
    ))}</>;

  const Activity = () => recentActivity.length===0
    ? <div style={{textAlign:"center",padding:"20px 0",fontSize:9,color:"rgba(255,255,255,0.15)"}}>No marketplace activity</div>
    : <>{recentActivity.map((a,i)=>(
      <div key={a.hash+i} style={{padding:"8px 10px",marginBottom:5,borderRadius:9,
        background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:8,fontWeight:"bold",letterSpacing:"0.07em",padding:"2px 6px",borderRadius:4,
            background:a.type==="BUY"?"rgba(74,222,128,0.08)":"rgba(248,113,113,0.08)",
            border:`1px solid ${a.type==="BUY"?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`,
            color:a.type==="BUY"?"#4ade80":"#f87171"}}>{a.type}</span>
          <span style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:"'DM Mono',monospace"}}>#{a.tokenID}</span>
          <span style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>{timeAgo(a.time)}</span>
        </div>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",fontFamily:"'DM Mono',monospace"}}>
          {a.type==="BUY"
            ?<><span style={{color:"rgba(255,255,255,0.15)"}}>to </span>{short(a.buyer)}</>
            :<><span style={{color:"rgba(255,255,255,0.15)"}}>from </span>{short(a.seller)}</>}
        </div>
      </div>
    ))}</>;

  const Whales = () => whaleAlerts.length===0
    ? <div style={{textAlign:"center",padding:"20px 0",fontSize:9,color:"rgba(255,255,255,0.15)"}}>No alerts in 48h window</div>
    : <>{whaleAlerts.map((a)=>(
      <div key={a.addr} onClick={()=>{
        const node=graph.nodes.find(n=>n.id===a.addr);
        if(node){setSelected(node);setRightTab("inspector");}
      }} style={{padding:"9px 10px",marginBottom:5,borderRadius:9,cursor:"pointer",
        background:"rgba(245,195,0,0.03)",border:"1px solid rgba(245,195,0,0.09)",transition:"all 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(245,195,0,0.08)"}
        onMouseLeave={e=>e.currentTarget.style.background="rgba(245,195,0,0.03)"}>
        <div style={{fontSize:8,color:"rgba(245,195,0,0.4)",marginBottom:3,fontFamily:"'DM Mono',monospace"}}>{short(a.addr)}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:12,color:"#F5C300",fontWeight:"bold",fontFamily:"'DM Mono',monospace"}}>{a.count} moves</span>
          <span style={{fontSize:8,color:"rgba(245,195,0,0.35)",background:"rgba(245,195,0,0.07)",
            padding:"2px 6px",borderRadius:4}}>48h</span>
        </div>
      </div>
    ))}</>;

  const RightPanel = ({flex=false}) => (
    <div style={{...card,display:"flex",flexDirection:"column",overflow:"hidden",...(flex?{flex:1}:{})}}>
      <div style={{display:"flex",borderBottom:"1px solid #141414",flexShrink:0}}>
        <TabBtn label="INSPECTOR" active={rightTab==="inspector"} onClick={()=>setRightTab("inspector")}/>
        <TabBtn label="TOP 10"    active={rightTab==="top10"}     onClick={()=>setRightTab("top10")}/>
        <TabBtn label="ACTIVITY"  active={rightTab==="activity"}  onClick={()=>setRightTab("activity")} badge={recentActivity.length}/>
        <TabBtn label="WHALES"    active={rightTab==="whales"}    onClick={()=>setRightTab("whales")} badge={whaleAlerts.length}/>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px"}}>
        {rightTab==="inspector"&&<Inspector/>}
        {rightTab==="top10"    &&<Top10/>}
        {rightTab==="activity" &&<Activity/>}
        {rightTab==="whales"   &&<Whales/>}
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"#000",
      color:"#fff",fontFamily:"'DM Mono',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#222;border-radius:3px;}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {/* LOADING OVERLAY */}
      {loadingProgress>0&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",
          zIndex:999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <div style={{width:48,height:48,border:"3px solid rgba(245,195,0,0.2)",
            borderTop:"3px solid #F5C300",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#F5C300"}}>
            Loading On-Chain Data
          </div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:"0.1em"}}>
            FETCHING FULL HISTORY · {loadingProgress}%
          </div>
          <div style={{width:200,height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",background:"#F5C300",borderRadius:2,
              width:loadingProgress+"%",transition:"width 0.3s ease"}}/>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:isMobile?"11px 14px":"13px 20px",borderBottom:"1px solid #141414",
        background:"#000",flexShrink:0,flexWrap:"wrap",gap:8}}>
        <img src="data:image/png;base64,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" alt="Dope Ape Club"
          style={{height:isMobile?26:36,width:"auto",objectFit:"contain"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
          {demoMode
            ?<div style={{fontSize:9,padding:"4px 10px",borderRadius:6,letterSpacing:"0.07em",
                background:"rgba(245,195,0,0.07)",border:"1px solid rgba(245,195,0,0.2)",color:"#F5C300"}}>⚡ DEMO</div>
            :<div style={{fontSize:9,padding:"4px 10px",borderRadius:6,letterSpacing:"0.07em",
                background:"rgba(74,222,128,0.07)",border:"1px solid rgba(74,222,128,0.2)",
                color:"#4ade80",animation:"pulse 3s infinite"}}>● LIVE</div>
          }
          <div onClick={()=>setShowInput(v=>!v)} style={{width:32,height:32,display:"flex",
            alignItems:"center",justifyContent:"center",borderRadius:8,cursor:"pointer",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
          </div>
        </div>
        <div style={{width:"100%",fontSize:9,color:"rgba(255,255,255,0.15)",letterSpacing:"0.06em",marginTop:-4}}>
          {CONTRACT.slice(0,10)}…{CONTRACT.slice(-8)} · ERC-721
        </div>
      </div>

      {showInput&&(
        <div style={{padding:"11px 16px",borderBottom:"1px solid #141414",flexShrink:0}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",marginBottom:7,letterSpacing:"0.07em"}}>ETHERSCAN API KEY</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input value={apiKey} onChange={e=>setApiKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fetchLive()}
              placeholder="API key…" style={{flex:1,minWidth:180,background:"rgba(255,255,255,0.04)",
                border:"1px solid #1C1C1C",color:"#fff",padding:"7px 11px",borderRadius:8,
                fontSize:10,fontFamily:"inherit",outline:"none"}}/>
            <button onClick={fetchLive} disabled={loading||!apiKey.trim()} style={{
              background:"rgba(245,195,0,0.1)",border:"1px solid rgba(245,195,0,0.35)",
              color:"#F5C300",padding:"7px 14px",borderRadius:8,fontSize:10,fontFamily:"inherit",
              cursor:loading?"wait":"pointer",opacity:!apiKey.trim()?0.35:1}}>
              {loading?"LOADING…":"FETCH LIVE"}
            </button>
          </div>
          {error&&<div style={{marginTop:6,fontSize:9,color:"#f87171"}}>{error}</div>}
        </div>
      )}

      {isMobile?(
        <div style={{flex:1,display:"flex",flexDirection:"column",padding:"11px",gap:9,overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Tile label="TOTAL TRANSFERS" value={stats.txs}     accent="#F5C300"/>
            <Tile label="UNIQUE WALLETS"  value={stats.wallets} accent="#FFF"/>
            <Tile label="TOKENS TRACKED"  value={stats.tokens}  accent="#888"/>
            <Tile label="MARKET SALES"    value={stats.mkt}     accent="#F5C300"/>
          </div>
          <div style={{...card}}>
            <div style={{padding:"11px 13px 9px",borderBottom:"1px solid #141414"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:700,color:"#fff",marginBottom:5}}>
                Ownership Cluster
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {fBtn("all","All")}{fBtn("buysell","Mkt")}{fBtn("walletonly","Wallet→Wallet")}
              </div>
            </div>
            <div style={{position:"relative",height:280}}>
              <svg ref={svgRef} style={{width:"100%",height:"100%",display:"block"}}/>
              <div style={{position:"absolute",bottom:8,left:11,display:"flex",gap:10,
                fontSize:8,color:"rgba(255,255,255,0.18)"}}>
                {[["#fff","Wallet"],["#555","Mkt"],["#F5C300","Whale"]].map(([c,l])=>(
                  <span key={l}><span style={{color:c}}>●</span> {l}</span>
                ))}
              </div>
            </div>
          </div>
          <RightPanel/>
        </div>
      ):(
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={{width:54,display:"flex",flexDirection:"column",alignItems:"center",
            padding:"13px 0",gap:5,background:"#000",borderRight:"1px solid #141414",flexShrink:0}}>
            {["M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
              "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6","M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            ].map((path,i)=>(
              <div key={i} style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",
                borderRadius:8,cursor:"pointer",
                background:i===0?"rgba(245,195,0,0.08)":"transparent",
                border:`1px solid ${i===0?"rgba(245,195,0,0.25)":"transparent"}`}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={i===0?"#F5C300":"rgba(255,255,255,0.18)"} strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
              </div>
            ))}
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 17px 14px 12px",gap:9}}>
            <div style={{display:"flex",gap:9,flexShrink:0}}>
              <Tile label="TOTAL TRANSFERS" value={stats.txs}     accent="#F5C300"/>
              <Tile label="UNIQUE WALLETS"  value={stats.wallets} accent="#FFFFFF"/>
              <Tile label="TOKENS TRACKED"  value={stats.tokens}  accent="#888888"/>
              <Tile label="MARKET SALES"    value={stats.mkt}     accent="#F5C300"/>
            </div>
            <div style={{flex:1,display:"flex",gap:10,overflow:"hidden",minHeight:0}}>
              <div style={{...card,flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"11px 15px 10px",borderBottom:"1px solid #141414",flexShrink:0,flexWrap:"wrap",gap:7}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:"#fff"}}>Ownership Cluster</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.18)",marginTop:1}}>
                      {graph.nodes.length} wallets · {graph.links.length} connections
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    {fBtn("all","All")}{fBtn("buysell","Marketplace")}{fBtn("walletonly","Wallet → Wallet")}
                  </div>
                </div>
                <div style={{flex:1,position:"relative",minHeight:0}}>
                  <svg ref={svgRef} style={{width:"100%",height:"100%",display:"block"}}/>
                  <div style={{position:"absolute",bottom:10,left:13,display:"flex",gap:12,
                    fontSize:9,color:"rgba(255,255,255,0.18)"}}>
                    {[["#fff","Wallet"],["#555","Marketplace"],["#F5C300","Whale"]].map(([c,l])=>(
                      <span key={l}><span style={{color:c}}>●</span> {l}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{width:258,flexShrink:0,display:"flex",flexDirection:"column"}}>
                <RightPanel flex/>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
