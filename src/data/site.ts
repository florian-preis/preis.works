// Site-wide details: name, description, contact, and links.
export const site = {
  name: 'Florian Preis',
  description:
    'Life science consulting by day. Side projects, photography, and the occasional deep dive the rest of the time.',
  email: 'hello@preis.works',
  // The phone number never appears in the page source. It is stored as character
  // codes and only assembled in the browser once a visitor scrolls, touches, or moves the mouse.
  phoneCodes: [52, 53, 53, 48, 51, 51, 49, 51, 55, 48],
  linkedin: 'https://www.linkedin.com/in/florianpreis/',
  instagram: 'https://www.instagram.com/florianprice/',
};

export const nav = [
  { key: 'about', label: 'About', href: '/' },
  { key: 'photography', label: 'Photography', href: '/photography/' },
  { key: 'projects', label: 'Projects', href: '/projects/' },
];
