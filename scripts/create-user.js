const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const [mode, email, role, firstName, lastName, password, grade] = process.argv.slice(2);

  if (!mode || !email || !role || !firstName || !lastName) {
    console.log(
      'Usage: node scripts/create-user.js <create|update> <email> <role> <firstName> <lastName> [password] [grade]',
    );
    process.exit(1);
  }

  const uppercaseRole = role.toUpperCase();
  const validRoles = ['STUDENT', 'PARENT', 'ADMIN'];
  if (!validRoles.includes(uppercaseRole)) {
    console.error('Role must be one of: STUDENT, PARENT, ADMIN');
    process.exit(1);
  }

  const userData = {
    email,
    role: uppercaseRole,
    firstName,
    lastName,
    grade: grade ? parseInt(grade, 10) : undefined,
  };

  if (password) {
    userData.passwordHash = await bcrypt.hash(password, 10);
  }

  if (mode === 'create') {
    const user = await prisma.user.create({ data: userData });
    console.log('User created:', user.id, user.email, user.role);
  } else if (mode === 'update') {
    const updateData = { ...userData };
    if (!password) delete updateData.passwordHash;
    if (!grade) delete updateData.grade;

    // Check if user exists; use upsert to create if missing
    const existing = await prisma.user.findUnique({ where: { email } });
    const user = await prisma.user.upsert({
      where: { email },
      update: updateData,
      create: userData,
    });

    if (existing) {
      console.log('User updated:', user.id, user.email, user.role);
    } else {
      console.log('User did not exist; created:', user.id, user.email, user.role);
    }
  } else {
    console.log('Unknown mode:', mode);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
