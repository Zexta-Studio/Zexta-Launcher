const electron = require('electron');
console.log('Keys in electron module:', Object.keys(electron));
if (electron.app) {
  console.log('App found!');
} else {
  console.log('App is undefined!');
}
