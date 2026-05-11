const fs = require('fs');

const replacements = [
  // Dashboard.css
  { from: /var\(--green-dim\)/g, to: 'rgba(20, 184, 166, 0.1)' },
  { from: /#86efac/g, to: '#5eead4' }, // light green -> light teal
  { from: /rgba\(245,158,11,0\.12\)/g, to: 'rgba(20, 184, 166, 0.15)' },
  { from: /#fcd34d/g, to: '#2dd4bf' }, // yellow -> teal
  { from: /var\(--red-dim\)/g, to: 'rgba(20, 184, 166, 0.2)' },
  { from: /#fca5a5/g, to: '#14b8a6' }, // red -> teal

  // Dashboard.jsx
  { from: /var\(--amber\)/g, to: 'var(--teal-primary)' },

  // CodingRound.css
  { from: /#ef4444/g, to: '#0f766e' }, // dark red -> dark teal
  { from: /#f59e0b/g, to: '#14b8a6' }, // orange -> teal
  { from: /#22c55e/g, to: '#5eead4' }, // green -> light teal

  // Evaluation.css / Evaluation.jsx
  { from: /#818cf8/g, to: '#5eead4' }, // indigo -> light teal
  { from: /#f472b6/g, to: '#2dd4bf' }, // pink -> teal
  { from: /#34d399/g, to: '#14b8a6' }, // emerald -> teal
  { from: /#fb923c/g, to: '#0d9488' }, // orange -> dark teal
];

const files = [
  'src/components/Dashboard/Dashboard.css',
  'src/components/Dashboard/Dashboard.jsx',
  'src/components/Coding/CodingRound.css',
  'src/components/Coding/CodingRound.jsx',
  'src/components/Evaluation/Evaluation.css',
  'src/components/Evaluation/Evaluation.jsx',
  'src/components/FollowUp/FollowUp.jsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(file, content);
  }
});
console.log("Teal overrides applied!");
