const fs = require('fs');

const replacements = [
  { from: /#ef4444/g, to: '#0f766e' },
  { from: /var\(--amber\)/g, to: 'var(--teal-primary)' },
  { from: /#fca5a5/g, to: '#5eead4' },
  { from: /#fcd34d/g, to: '#2dd4bf' },
  { from: /#f59e0b/g, to: '#14b8a6' },
];

const files = [
  'src/components/shared/MonitorSidebar.css',
  'src/components/shared/MonitorSidebar.jsx',
  'src/components/shared/ViolationWarning.css',
  'src/components/shared/ViolationWarning.jsx',
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
console.log("Teal overrides applied to shared!");
