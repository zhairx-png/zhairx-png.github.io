const fs = require('fs');
const files = [
  'src/assets/images/张椽和黄寿诗.png',
  'src/assets/images/张楫题诗.png',
  'src/assets/images/游白鹤梁.png'
];
files.forEach(f => {
  try {
    console.log(f, fs.statSync(f).size);
  } catch(e) { console.log(f, 'not found')}
});
