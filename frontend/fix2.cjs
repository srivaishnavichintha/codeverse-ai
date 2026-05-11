const fs = require('fs');
let code = fs.readFileSync('src/pages/Solve/SolvePage.jsx', 'utf8');

code = code.replace(
  `  return (
    <div className="cv-console">
      <div className="cv-console-head">
        <button
          className={\`cv-solve-tab\${section === "cases" ? " active" : ""}\`}
          onClick={() => setSection("cases")}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          Testcases
        </button>
        <button
          className={\`cv-solve-tab\${section === "result" ? " active" : ""}\`}
          onClick={() => setSection("result")}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          Result
        </button>
      </div>`,
  `  return (
    <div className={\`cv-console \${isOpen ? 'is-open' : 'is-closed'}\`}>
      <div className="cv-console-head" onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(!isOpen); }}>
        <div style={{display:'flex', gap:4}}>
          <button
            className={\`cv-solve-tab\${section === "cases" ? " active" : ""}\`}
            onClick={() => { setSection("cases"); setIsOpen(true); }}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            Testcases
          </button>
          <button
            className={\`cv-solve-tab\${section === "result" ? " active" : ""}\`}
            onClick={() => { setSection("result"); setIsOpen(true); }}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            Result
          </button>
        </div>
        <div style={{flex: 1}} onClick={() => setIsOpen(!isOpen)} />
        <button className="cv-iconbtn" onClick={() => setIsOpen(!isOpen)} style={{marginRight:8}}>
          <Icon name={isOpen ? "chevronDown" : "chevronUp"} size={14} />
        </button>
      </div>`
);

fs.writeFileSync('src/pages/Solve/SolvePage.jsx', code);
console.log('Fixed ConsolePane isOpen logic!');
