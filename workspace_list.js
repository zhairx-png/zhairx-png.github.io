const fs = require('fs');
const path = require('path');
function list(dir) {
  try {
  const files = fs.readdirSync(dir);
  for(let file of files) {
    const stat = fs.statSync(path.join(dir, file));
    console.log(file, stat.mtime);
  }
  } catch (e) {
  }
}
list(path.join(process.cwd(), 'public'));
list(path.join(process.cwd(), 'src/assets/images'));
