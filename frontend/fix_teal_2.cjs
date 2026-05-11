const fs = require('fs');

const replacements = [
  { from: /rgba\(239, 68, 68, 0\.1\)/g, to: 'rgba(20, 184, 166, 0.1)' },
  { from: /rgba\(239, 68, 68, 0\.3\)/g, to: 'rgba(20, 184, 166, 0.3)' },
  { from: /#fca5a5/g, to: '#5eead4' },
  { from: /var\(--green\)/g, to: 'var(--teal-primary)' },
  { from: /var\(--red\)/g, to: 'var(--teal-primary)' },
  { from: /#dc2626/g, to: '#0d9488' },
  { from: /#ef4444/g, to: '#0f766e' },
  { from: /#22c55e/g, to: '#14b8a6' },
];

const files = [
  'src/components/Interview/Permissions.jsx',
  'src/components/Interview/Permissions.css',
  'src/components/FollowUp/FollowUp.jsx',
  'src/components/FollowUp/FollowUp.css',
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
console.log("Teal overrides applied to Permissions and FollowUp!");
