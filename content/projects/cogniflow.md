---
# The project page lives at /projects/cogniflow/ (the filename decides the address)
name: cogniflow
category: Reading tool
order: 4
# "What it is" on the project page. Its first sentence is also the description search engines show
summary: A word-by-word reader for articles and short texts. Paste a text, send an article straight from your browser with a bookmark, or drop in a TXT, Word, or PDF file, and read at your own speed. Each word is lined up on the letter your eye should land on, marked in coral, so your eyes can stay still while the text moves. Pause to see the surrounding paragraphs and tap any word to jump there. The timing follows the text, slowing down for long words, commas, and the end of each sentence. Every text is saved automatically with your place in it, and your library stays in your browser.
app: /projects/cogniflow/app/
year: "2025"
# Picture on the card and at the top of the page. focus = which part stays in view when cropped (x% y%)
image: ./images/cogniflow/mockup.jpg
focus: 50% 50%
# Screens at the bottom of the page, in order. alt describes each one for screen readers
screens:
  - src: ./images/cogniflow/screen-1.jpg
    alt: Pasting a new text to read
  - src: ./images/cogniflow/screen-2.jpg
    alt: Paused mid-article, with the surrounding paragraphs shown
  - src: ./images/cogniflow/screen-3.jpg
    alt: Reading, one word at a time with the focus letter in coral
  - src: ./images/cogniflow/screen-4.jpg
    alt: The library of saved texts with progress and time left
  - src: ./images/cogniflow/screen-5.jpg
    alt: Keyboard shortcuts
---

I kept coming across word-by-word readers that promised better focus, and I noticed my own attention drifting on long articles, even ones I was really interested in. None of the existing tools quite clicked, in looks or in features, and Claude Code had just come out, so it felt like the perfect excuse to see what I could build.

In the rebuild I narrowed it to what it does best: reading a news article or an essay properly, sent straight from the browser, with every word lined up so your eyes can stay still. It was also the project that first showed me how far AI tools can take an idea, at work and outside of it.
