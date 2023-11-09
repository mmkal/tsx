"use strict";const e=process.versions.node.split(".").map(Number),o=s=>e[0]-s[0]||e[1]-s[1]||e[2]-s[2],t=o([20,0,0])>=0,r=o([20,6,0])>=0;exports.isolatedLoader=t,exports.supportsModuleRegister=r;
