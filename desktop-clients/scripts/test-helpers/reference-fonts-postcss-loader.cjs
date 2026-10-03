/** Test-only adapter: run the host's Tailwind/PostCSS plugin before Next's CSS loader. */
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
module.exports = function (source) {
  const done = this.async();
  postcss([tailwind({optimize: false})])
    .process(source, {from: this.resourcePath})
    .then(result => done(null, result.css), done);
};
