const fs = require('fs');

const filesToUpdate = [
  {
    path: 'src/pages/Problems/Problems.css',
    replacements: [
      { from: /max-width: 1480px;/g, to: 'width: 100%;' },
      { from: /margin: 0 auto;/g, to: 'margin: 0;' },
      { from: /padding: 28px clamp\(16px, 3vw, 40px\) 60px;/g, to: 'padding: 28px 40px 60px;' }
    ]
  },
  {
    path: 'src/pages/PeerChallenge/PeerChallenge.css',
    replacements: [
      { from: /max-width: 1280px;/g, to: 'width: 100%;' },
      { from: /margin: 0 auto;/g, to: 'margin: 0;' },
      { from: /padding: 28px clamp\(16px, 3vw, 40px\) 60px;/g, to: 'padding: 28px 40px 60px;' }
    ]
  },
  {
    path: 'src/pages/Discussions/Discussions.css',
    replacements: [
      { from: /max-width: 1440px;/g, to: 'width: 100%;' },
      { from: /margin: 0 auto;/g, to: 'margin: 0;' },
      { from: /padding: 28px clamp\(16px, 3vw, 40px\) 60px;/g, to: 'padding: 28px 40px 60px;' }
    ]
  },
  {
    path: 'src/pages/Discussions/DiscussionDetailPage.jsx',
    replacements: [
      { from: /maxWidth: 800, margin: "0 auto", width: "100%", padding: "20px 0"/g, to: 'width: "100%", padding: "20px 40px"' }
    ]
  },
  {
    path: 'src/pages/Battleground/Contests.css',
    replacements: [
      { from: /max-width: 1280px;/g, to: 'width: 100%;' },
      { from: /margin: 0 auto;/g, to: 'margin: 0;' },
      { from: /padding: 28px clamp\(16px, 3vw, 40px\) 60px;/g, to: 'padding: 28px 40px 60px;' }
    ]
  },
  {
    path: 'src/components/Dashboard/Dashboard.css',
    replacements: [
      { from: /max-width: 1300px;/g, to: 'width: 100%;' },
      { from: /margin: 0 auto;/g, to: 'margin: 0;' },
      { from: /padding: 80px 32px 48px;/g, to: 'padding: 80px 40px 48px;' }
    ]
  }
];

filesToUpdate.forEach(fileObj => {
  if (fs.existsSync(fileObj.path)) {
    let content = fs.readFileSync(fileObj.path, 'utf8');
    fileObj.replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(fileObj.path, content);
  } else {
    console.log("Not found: " + fileObj.path);
  }
});
console.log("Layout updates applied!");
