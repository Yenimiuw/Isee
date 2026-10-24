// Usage: npm run create-educator -- teacher@school.edu "password" "Full Name"
require('dotenv').config();
const { createUser } = require('../lib/users');

(async () => {
  const [email, password, ...name] = process.argv.slice(2);
  if (!email || !password || !name.length) {
    console.error('Usage: npm run create-educator -- <email> <password> "<Full Name>"');
    process.exit(1);
  }
  const user = await createUser({ email: email.toLowerCase(), password, fullName: name.join(' '), role: 'educator' });
  console.log(`Created educator ${email} (${user.id})`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
