const fs = require('fs');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.aistudio') return;
    const path = dir + '/' + file;
    const stat = fs.statSync(path);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(path));
    } else {
      results.push(path.replace('./', ''));
    }
  });
  return results;
}
console.log(walk('.'));
