import { useState, useRef, useEffect, useCallback } from "react";

// ── MODELS ──────────────────────────────────────────────────────────────────
const MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic", color: "#D97757" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", color: "#e8a87c" },
];

// ── AGENTS ───────────────────────────────────────────────────────────────────
const AGENT_TYPES = [
  { id: "coder",      icon: "⟨/⟩", label: "Coder",      color: "#2dd4bf", desc: "Writes & refactors code" },
  { id: "researcher", icon: "◎",   label: "Researcher", color: "#818cf8", desc: "Gathers & analyzes info" },
  { id: "tester",     icon: "✓",   label: "Tester",     color: "#34d399", desc: "Writes tests & QA" },
  { id: "reviewer",   icon: "👁",   label: "Reviewer",   color: "#fbbf24", desc: "Reviews code quality" },
  { id: "architect",  icon: "⬡",   label: "Architect",  color: "#f472b6", desc: "Designs system structure" },
  { id: "security",   icon: "⚔",   label: "Security",   color: "#f87171", desc: "Audits for vulnerabilities" },
];

// ── SWARM TOPOLOGIES ─────────────────────────────────────────────────────────
const TOPOLOGIES = [
  { id: "hierarchical", label: "Hierarchical", icon: "⬡", desc: "Queen-led command structure" },
  { id: "mesh",         label: "Mesh",         icon: "⬡⬡", desc: "Peer-to-peer collaboration" },
  { id: "adaptive",     label: "Adaptive",     icon: "◈",  desc: "Dynamic topology shifting" },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function AgentBadge({ agent, onRemove }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      background:"rgba(255,255,255,0.04)", border:`1px solid ${agent.color}44`,
      borderRadius:4, padding:"3px 10px 3px 8px",
      fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:agent.color,
    }}>
      {agent.icon} {agent.label}
      <button onClick={() => onRemove(agent.instanceId)}
        style={{ background:"none", border:"none", color:"#666", cursor:"pointer", padding:0, marginLeft:2, fontSize:12, lineHeight:1 }}>×</button>
    </span>
  );
}

function ToolCallBubble({ call }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      margin:"4px 0", background:"rgba(45,212,191,0.05)", border:"1px solid rgba(45,212,191,0.15)",
      borderRadius:6, overflow:"hidden",
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:8,
        background:"none", border:"none", padding:"7px 12px", cursor:"pointer",
        fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#2dd4bf", textAlign:"left",
      }}>
        <span style={{ opacity:0.6 }}>{open ? "▾" : "▸"}</span>
        <span style={{ opacity:0.5 }}>tool</span>
        <strong>{call.name}</strong>
        {call.status === "running" && <span style={{ marginLeft:"auto", opacity:0.5, animation:"spin 1s linear infinite", display:"inline-block" }}>◌</span>}
        {call.status === "done"    && <span style={{ marginLeft:"auto", color:"#34d399" }}>✓</span>}
      </button>
      {open && (
        <div style={{ padding:"0 12px 10px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#6b7280" }}>
          <div style={{ color:"#9ca3af", marginBottom:4 }}>input:</div>
          <pre style={{ margin:0, color:"#d1d5db", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
            {JSON.stringify(call.input, null, 2)}
          </pre>
          {call.output && <>
            <div style={{ color:"#9ca3af", marginTop:8, marginBottom:4 }}>output:</div>
            <pre style={{ margin:0, color:"#d1d5db", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{call.output}</pre>
          </>}
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) return (
    <div style={{ textAlign:"center", padding:"8px 0" }}>
      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563",
        background:"rgba(255,255,255,0.03)", border:"1px solid #1f2937", borderRadius:20, padding:"3px 14px" }}>
        {msg.content}
      </span>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:12, justifyContent: isUser ? "flex-end" : "flex-start", marginBottom:2 }}>
      {!isUser && (
        <div style={{
          width:28, height:28, borderRadius:6, background:"rgba(217,119,87,0.15)",
          border:"1px solid rgba(217,119,87,0.3)", display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:12, flexShrink:0, marginTop:2,
        }}>◈</div>
      )}
      <div style={{ maxWidth:"72%", minWidth:0 }}>
        {msg.agentLabel && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#6b7280", marginBottom:4 }}>
            via {msg.agentLabel}
          </div>
        )}
        {/* Tool calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ marginBottom:6 }}>
            {msg.toolCalls.map(tc => <ToolCallBubble key={tc.id} call={tc} />)}
          </div>
        )}
        {/* Text content */}
        {msg.content && (
          <div style={{
            background: isUser ? "rgba(217,119,87,0.12)" : "rgba(255,255,255,0.04)",
            border: isUser ? "1px solid rgba(217,119,87,0.25)" : "1px solid rgba(255,255,255,0.07)",
            borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
            padding:"11px 15px",
            fontFamily:"'Söhne',system-ui,sans-serif", fontSize:14, lineHeight:1.65, color:"#e2e8f0",
            whiteSpace:"pre-wrap", wordBreak:"break-word",
          }}>
            {msg.streaming ? (
              <>{msg.content}<span style={{ display:"inline-block", width:7, height:14,
                background:"#D97757", marginLeft:2, verticalAlign:"middle",
                animation:"blink 1s step-end infinite" }} /></>
            ) : msg.content}
          </div>
        )}
      </div>
      {isUser && (
        <div style={{
          width:28, height:28, borderRadius:6, background:"rgba(255,255,255,0.07)",
          border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:12, flexShrink:0, marginTop:2, color:"#9ca3af",
        }}>U</div>
      )}
    </div>
  );
}

// ── SIDEBAR PANEL ─────────────────────────────────────────────────────────────
function Sidebar({ activeAgents, setActiveAgents, swarm, setSwarm, memory, tab, setTab, systemPrompt, setSystemPrompt }) {
  const [addingAgent, setAddingAgent] = useState(false);

  function spawnAgent(type) {
    const t = AGENT_TYPES.find(a => a.id === type);
    setActiveAgents(prev => [...prev, { ...t, instanceId: uid() }]);
    setAddingAgent(false);
  }

  return (
    <div style={{
      width:240, flexShrink:0, borderRight:"1px solid #1a1a2e",
      display:"flex", flexDirection:"column", background:"#0a0a12", overflow:"hidden",
    }}>
      {/* Tab headers */}
      <div style={{ display:"flex", borderBottom:"1px solid #1a1a2e" }}>
        {["Agents","Swarm","Memory","Config"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:"11px 0", background:"none", border:"none", cursor:"pointer",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:"0.5px",
            color: tab === t ? "#D97757" : "#4b5563",
            borderBottom: tab === t ? "2px solid #D97757" : "2px solid transparent",
            transition:"all 0.15s",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* ── AGENTS TAB ── */}
        {tab === "Agents" && (
          <>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>
              Active Agents
            </div>
            {activeAgents.length === 0 && (
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#374151", textAlign:"center", padding:"24px 0" }}>
                No agents spawned.<br/>Add one below.
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
              {activeAgents.map(a => (
                <div key={a.instanceId} style={{
                  display:"flex", alignItems:"center", gap:8,
                  background:"rgba(255,255,255,0.03)", border:`1px solid ${a.color}22`,
                  borderRadius:6, padding:"8px 10px",
                }}>
                  <span style={{ color:a.color, fontSize:14 }}>{a.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:a.color }}>{a.label}</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#4b5563", marginTop:1 }}>{a.desc}</div>
                  </div>
                  <button onClick={() => setActiveAgents(p => p.filter(x => x.instanceId !== a.instanceId))}
                    style={{ background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:14, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
            {!addingAgent ? (
              <button onClick={() => setAddingAgent(true)} style={{
                width:"100%", padding:"8px", background:"rgba(217,119,87,0.08)",
                border:"1px dashed rgba(217,119,87,0.3)", borderRadius:6, cursor:"pointer",
                fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#D97757",
              }}>+ Spawn Agent</button>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {AGENT_TYPES.map(a => (
                  <button key={a.id} onClick={() => spawnAgent(a.id)} style={{
                    display:"flex", alignItems:"center", gap:8,
                    background:"rgba(255,255,255,0.02)", border:`1px solid ${a.color}33`,
                    borderRadius:5, padding:"7px 10px", cursor:"pointer", textAlign:"left",
                  }}>
                    <span style={{ color:a.color, fontSize:13 }}>{a.icon}</span>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#9ca3af" }}>{a.label}</span>
                  </button>
                ))}
                <button onClick={() => setAddingAgent(false)} style={{
                  background:"none", border:"none", cursor:"pointer",
                  fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", padding:"4px 0",
                }}>cancel</button>
              </div>
            )}
          </>
        )}

        {/* ── SWARM TAB ── */}
        {tab === "Swarm" && (
          <>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>
              Topology
            </div>
            {TOPOLOGIES.map(t => (
              <button key={t.id} onClick={() => setSwarm(s => ({ ...s, topology: t.id }))} style={{
                width:"100%", display:"flex", alignItems:"center", gap:10,
                background: swarm.topology === t.id ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.02)",
                border: swarm.topology === t.id ? "1px solid rgba(45,212,191,0.3)" : "1px solid #1a1a2e",
                borderRadius:6, padding:"10px 12px", cursor:"pointer", marginBottom:6, textAlign:"left",
              }}>
                <span style={{ color:"#2dd4bf", fontSize:16 }}>{t.icon}</span>
                <div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11,
                    color: swarm.topology === t.id ? "#2dd4bf" : "#9ca3af" }}>{t.label}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#4b5563", marginTop:1 }}>{t.desc}</div>
                </div>
              </button>
            ))}
            <div style={{ marginTop:20, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", letterSpacing:"1px", textTransform:"uppercase", marginBottom:8 }}>
              Max Agents: {swarm.maxAgents}
            </div>
            <input type="range" min={2} max={20} value={swarm.maxAgents}
              onChange={e => setSwarm(s => ({ ...s, maxAgents: +e.target.value }))}
              style={{ width:"100%", accentColor:"#2dd4bf" }} />
            <div style={{ marginTop:20, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", letterSpacing:"1px", textTransform:"uppercase", marginBottom:8 }}>
              Status
            </div>
            <div style={{
              background:"rgba(255,255,255,0.02)", border:"1px solid #1a1a2e", borderRadius:6, padding:12,
              fontFamily:"'IBM Plex Mono',monospace", fontSize:11, lineHeight:2,
            }}>
              <div><span style={{ color:"#4b5563" }}>topology: </span><span style={{ color:"#2dd4bf" }}>{swarm.topology}</span></div>
              <div><span style={{ color:"#4b5563" }}>agents: </span><span style={{ color:"#e2e8f0" }}>{activeAgents.length}</span></div>
              <div><span style={{ color:"#4b5563" }}>max: </span><span style={{ color:"#e2e8f0" }}>{swarm.maxAgents}</span></div>
              <div><span style={{ color:"#4b5563" }}>status: </span>
                <span style={{ color: activeAgents.length > 0 ? "#34d399" : "#4b5563" }}>
                  {activeAgents.length > 0 ? "active" : "idle"}
                </span>
              </div>
            </div>
          </>
        )}

        {/* ── MEMORY TAB ── */}
        {tab === "Memory" && (
          <>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>
              Stored Memories
            </div>
            {memory.length === 0 ? (
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#374151", textAlign:"center", padding:"24px 0" }}>
                No memories yet.<br/>Ask the AI to remember something.
              </div>
            ) : memory.map((m, i) => (
              <div key={i} style={{
                background:"rgba(255,255,255,0.02)", border:"1px solid #1a1a2e",
                borderRadius:6, padding:"9px 12px", marginBottom:6,
              }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#818cf8", marginBottom:3 }}>{m.key}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#9ca3af", lineHeight:1.5 }}>{m.value}</div>
              </div>
            ))}
          </>
        )}

        {/* ── CONFIG TAB ── */}
        {tab === "Config" && (
          <>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563", letterSpacing:"1px", textTransform:"uppercase", marginBottom:12 }}>
              System Prompt
            </div>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={10}
              placeholder="Enter a system prompt to guide the AI..."
              style={{
                width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid #1a1a2e",
                borderRadius:6, padding:"10px 12px", color:"#9ca3af", resize:"vertical",
                fontFamily:"'IBM Plex Mono',monospace", fontSize:11, lineHeight:1.6,
                outline:"none", boxSizing:"border-box",
              }}
            />
            <div style={{ marginTop:16, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#4b5563",
              letterSpacing:"1px", textTransform:"uppercase", marginBottom:8 }}>Quick Prompts</div>
            {[
              { label:"Coding assistant", prompt:"You are an expert software engineer. Help the user write clean, efficient, well-tested code. When relevant, spawn specialized agents for different tasks." },
              { label:"Research analyst", prompt:"You are a thorough research analyst. Use web search when needed. Synthesize information clearly and cite sources." },
              { label:"Swarm coordinator", prompt:"You are a multi-agent orchestration coordinator. Help the user spawn, manage, and coordinate AI agent swarms for complex tasks." },
            ].map(q => (
              <button key={q.label} onClick={() => setSystemPrompt(q.prompt)} style={{
                width:"100%", textAlign:"left", padding:"7px 10px", marginBottom:5,
                background:"rgba(255,255,255,0.02)", border:"1px solid #1a1a2e", borderRadius:5,
                cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#6b7280",
                transition:"color 0.15s",
              }}>{q.label}</button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function RufloApp() {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [model, setModel]             = useState(MODELS[0]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [swarm, setSwarm]             = useState({ topology:"hierarchical", maxAgents:8 });
  const [memory, setMemory]           = useState([]);
  const [sidebarTab, setSidebarTab]   = useState("Agents");
  const [systemPrompt, setSystemPrompt] = useState("You are Ruflo, an intelligent AI orchestration assistant. You help users manage multi-agent workflows, coordinate swarms, and accomplish complex tasks. Be concise, precise, and helpful. When users ask to spawn agents or manage workflows, describe what you would do clearly.");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  // Build context from agents/swarm for the system prompt
  function buildSystemContext() {
    let ctx = systemPrompt;
    if (activeAgents.length > 0) {
      ctx += `\n\nActive agents in this session: ${activeAgents.map(a => a.label).join(", ")}.`;
      ctx += ` Swarm topology: ${swarm.topology}, max agents: ${swarm.maxAgents}.`;
    }
    if (memory.length > 0) {
      ctx += `\n\nStored memories:\n${memory.map(m => `- ${m.key}: ${m.value}`).join("\n")}`;
    }
    return ctx;
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg = { id: uid(), role:"user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Build message history for API
    const history = [...messages, userMsg]
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.content || "" }))
      .filter(m => m.content);

    const assistantId = uid();
    setMessages(prev => [...prev, {
      id: assistantId, role:"assistant", content:"", streaming:true,
      agentLabel: activeAgents.length > 0 ? activeAgents.map(a=>a.label).join(" + ") : null,
      toolCalls:[],
    }]);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model: model.id,
          max_tokens: 1000,
          system: buildSystemContext(),
          messages: history,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error:{ message: res.statusText }}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream:true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              fullText += evt.delta.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ));
            }
          } catch {}
        }
      }

      // Finalize
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: fullText || "(no response)", streaming:false } : m
      ));

      // Check if assistant mentioned remembering something
      const rememberMatch = fullText.match(/remember(?:ing)?\s+(?:that\s+)?["']?([^"'\n.]{10,80})["']?/i);
      if (rememberMatch) {
        const key = `memory-${uid()}`;
        setMemory(prev => [...prev, { key, value: rememberMatch[1].trim() }]);
        setSidebarTab("Memory");
      }

    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content:`Error: ${err.message}`, streaming:false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, model, activeAgents, swarm, memory, systemPrompt]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function clearChat() {
    setMessages([]);
    setMemory([]);
  }

  const promptSuggestions = [
    "Spawn a coder + tester swarm and outline a REST API design",
    "Analyze what topology works best for a 5-agent code review",
    "Remember: my project uses TypeScript and Postgres",
    "What agents should I use for a security audit?",
  ];

  return (
    <div style={{
      display:"flex", flexDirection:"column", height:"100vh",
      background:"#080810", color:"#e2e8f0", fontFamily:"system-ui,sans-serif",
      overflow:"hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        textarea:focus, input:focus { outline: none; }
      `}</style>

      {/* ── TOPBAR ── */}
      <div style={{
        height:52, display:"flex", alignItems:"center", padding:"0 20px",
        borderBottom:"1px solid #0f0f1e", background:"#060609", flexShrink:0, gap:16,
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            width:26, height:26, background:"rgba(217,119,87,0.15)",
            border:"1px solid rgba(217,119,87,0.35)", borderRadius:6,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#D97757",
          }}>◈</div>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:500, color:"#e2e8f0", letterSpacing:"-0.3px" }}>ruflo</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#374151", marginLeft:4 }}>v3</span>
        </div>

        <div style={{ height:20, width:1, background:"#1a1a2e" }} />

        {/* Model picker */}
        <div style={{ position:"relative" }}>
          <button onClick={() => setShowModelMenu(o => !o)} style={{
            display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.03)",
            border:"1px solid #1a1a2e", borderRadius:6, padding:"5px 12px",
            cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#9ca3af",
          }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:model.color, flexShrink:0 }} />
            {model.label}
            <span style={{ opacity:0.4, fontSize:10 }}>▾</span>
          </button>
          {showModelMenu && (
            <div style={{
              position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:50,
              background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:8,
              overflow:"hidden", minWidth:200, boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
            }}>
              {MODELS.map(m => (
                <button key={m.id} onClick={() => { setModel(m); setShowModelMenu(false); }} style={{
                  width:"100%", display:"flex", alignItems:"center", gap:10,
                  padding:"10px 14px", background: model.id === m.id ? "rgba(255,255,255,0.05)" : "none",
                  border:"none", cursor:"pointer", textAlign:"left",
                  fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#9ca3af",
                  borderBottom:"1px solid #1a1a2e",
                }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:m.color }} />
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active agents badges */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1, overflow:"hidden" }}>
          {activeAgents.map(a => (
            <AgentBadge key={a.instanceId} agent={a}
              onRemove={id => setActiveAgents(p => p.filter(x => x.instanceId !== id))} />
          ))}
        </div>

        {/* Swarm status pill */}
        {activeAgents.length >= 2 && (
          <div style={{
            display:"flex", alignItems:"center", gap:6,
            background:"rgba(45,212,191,0.06)", border:"1px solid rgba(45,212,191,0.2)",
            borderRadius:20, padding:"3px 12px",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#2dd4bf",
          }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"#2dd4bf", animation:"blink 2s ease infinite" }} />
            swarm · {swarm.topology}
          </div>
        )}

        {/* Clear */}
        <button onClick={clearChat} style={{
          background:"none", border:"1px solid #1a1a2e", borderRadius:5,
          padding:"5px 12px", cursor:"pointer",
          fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#374151",
          transition:"color 0.15s",
        }}>clear</button>
      </div>

      {/* ── BODY ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* SIDEBAR */}
        <Sidebar
          activeAgents={activeAgents} setActiveAgents={setActiveAgents}
          swarm={swarm} setSwarm={setSwarm}
          memory={memory}
          tab={sidebarTab} setTab={setSidebarTab}
          systemPrompt={systemPrompt} setSystemPrompt={setSystemPrompt}
        />

        {/* CHAT AREA */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 32px", display:"flex", flexDirection:"column", gap:16 }}
            onClick={() => setShowModelMenu(false)}>
            {messages.length === 0 && (
              <div style={{ margin:"auto", textAlign:"center", maxWidth:480, animation:"fadeIn 0.5s ease" }}>
                <div style={{
                  width:52, height:52, borderRadius:12,
                  background:"rgba(217,119,87,0.1)", border:"1px solid rgba(217,119,87,0.25)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:22, margin:"0 auto 20px", color:"#D97757",
                }}>◈</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:18, fontWeight:500, color:"#e2e8f0", marginBottom:8 }}>
                  Ruflo AI
                </div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#4b5563", lineHeight:1.7, marginBottom:28 }}>
                  Multi-agent orchestration · Self-learning memory<br/>Swarm coordination · {model.label}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {promptSuggestions.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)} style={{
                      background:"rgba(255,255,255,0.02)", border:"1px solid #1a1a2e",
                      borderRadius:8, padding:"11px 14px", cursor:"pointer", textAlign:"left",
                      fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#6b7280",
                      lineHeight:1.5, transition:"all 0.15s",
                    }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => <Message key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding:"16px 32px 24px",
            borderTop:"1px solid #0f0f1e",
            background:"#060609",
            flexShrink:0,
          }}>
            <div style={{
              display:"flex", gap:12, alignItems:"flex-end",
              background:"rgba(255,255,255,0.03)", border:"1px solid #1a1a2e",
              borderRadius:10, padding:"12px 16px",
              transition:"border-color 0.15s",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={activeAgents.length > 0
                  ? `Message ${activeAgents.map(a=>a.label).join("+")} swarm…`
                  : "Message Ruflo… (Shift+Enter for newline)"}
                rows={1}
                disabled={isLoading}
                style={{
                  flex:1, background:"none", border:"none", resize:"none",
                  color:"#e2e8f0", fontSize:14, lineHeight:1.6,
                  fontFamily:"system-ui,sans-serif",
                  maxHeight:120, overflowY:"auto",
                }}
                onInput={e => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                style={{
                  width:34, height:34, borderRadius:7, flexShrink:0,
                  background: input.trim() && !isLoading ? "#D97757" : "#1a1a2e",
                  border:"none", cursor: input.trim() && !isLoading ? "pointer" : "default",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:14, color: input.trim() && !isLoading ? "#fff" : "#374151",
                  transition:"all 0.15s",
                }}>
                {isLoading ? (
                  <span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>◌</span>
                ) : "↑"}
              </button>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, padding:"0 2px" }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#1f2937" }}>
                {model.label} · {activeAgents.length} agent{activeAgents.length !== 1 ? "s" : ""} · {swarm.topology}
              </span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#1f2937" }}>
                Enter to send · Shift+Enter for newline
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
