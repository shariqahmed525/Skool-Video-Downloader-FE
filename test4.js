const str = "https://image.video.skool.com/abc/thumbnail.png";

const re1 = new RegExp('image\\\\.video\\\\.skool\\\\.com/([^/]+)/');
console.log("RE1 (4 slashes):", re1.test(str));

const re2 = new RegExp('image\\.video\\.skool\\.com/([^/]+)/');
console.log("RE2 (2 slashes):", re2.test(str));

const re3 = /image\.video\.skool\.com\/([^/]+)\//;
console.log("RE3 (literal):", re3.test(str));
