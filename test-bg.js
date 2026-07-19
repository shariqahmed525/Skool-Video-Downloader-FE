const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p id="p" style="background-image:url(&quot;https://image.video.skool.com/abc/thumbnail.png?token=xyz&quot;)"></p>`);
const el = dom.window.document.getElementById("p");
console.log(dom.window.getComputedStyle(el).backgroundImage);
