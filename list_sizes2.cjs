const fs = require('fs');
fs.readdirSync('.').forEach(f => {
  if (f.includes('白鹤时鸣') || f.includes('娄橒题记') || f.includes('送子观音') || f.includes('徐庄题记') || f.includes('杨公留题') || f.includes('双鱼记')) {
    console.log("FOUND ROOT:", f, fs.statSync(f).size);
  }
});
