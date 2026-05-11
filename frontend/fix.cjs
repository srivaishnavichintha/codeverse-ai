const fs = require('fs');
let code = fs.readFileSync('src/pages/Solve/SolvePage.jsx', 'utf8');

code = code.replace(
  `        {section === "result" && (
          !result ? (`,
  `        {section === "result" && (
          isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
              <div className="cv-dot-loader">
                <div className="cv-dot" style={{ backgroundColor: 'var(--primary-teal)' }}></div>
                <div className="cv-dot" style={{ backgroundColor: 'var(--primary-teal)' }}></div>
                <div className="cv-dot" style={{ backgroundColor: 'var(--primary-teal)' }}></div>
              </div>
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: 13, letterSpacing: 0.5 }}>Executing code...</span>
            </div>
          ) : !result ? (`
);

fs.writeFileSync('src/pages/Solve/SolvePage.jsx', code);
console.log('Fixed loader in SolvePage.jsx!');
