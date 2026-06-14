const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Usage: node scripts/check-login.js <email> <password>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found for email:', email);
    process.exit(1);
  }

  console.log('User found:', user.id, user.email, user.role);
  console.log('passwordHash present?', !!user.passwordHash);

  if (!user.passwordHash) {
    console.log('No passwordHash stored; cannot verify credentials.');
    process.exit(1);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log('Password match:', ok);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
