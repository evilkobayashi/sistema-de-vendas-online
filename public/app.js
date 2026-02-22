const sections = [...document.querySelectorAll('section')];
const dots = [...document.querySelectorAll('.dots span')];

if (dots.length) {
  let i = 0;
  setInterval(() => {
    dots.forEach((d) => d.classList.remove('active'));
    i = (i + 1) % dots.length;
    dots[i].classList.add('active');
  }, 2500);
}

window.addEventListener('scroll', () => {
  document.body.classList.toggle('scrolled', window.scrollY > 20);
});

console.log(`4BIO page loaded with ${sections.length} sections.`);
